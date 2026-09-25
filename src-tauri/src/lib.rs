use notify::{Config as NotifyConfig, RecommendedWatcher, RecursiveMode, Watcher};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::{mpsc, Mutex};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;
use walkdir::WalkDir;

/// Represents a node in the file tree
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub id: String,
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub children: Option<Vec<FileNode>>,
}

/// Represents an open tab
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenTab {
    pub id: String,
    pub file_path: String,
    pub file_name: String,
}

/// Application state shared across commands
pub struct AppState {
    pub vault_path: Mutex<Option<String>>,
    pub path_id_map: Mutex<HashMap<String, String>>,
    pub id_path_map: Mutex<HashMap<String, String>>,
    pub watcher: Mutex<Option<RecommendedWatcher>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            vault_path: Mutex::new(None),
            path_id_map: Mutex::new(HashMap::new()),
            id_path_map: Mutex::new(HashMap::new()),
            watcher: Mutex::new(None),
        }
    }
}

/// Patterns to ignore when building the file tree
const IGNORED_PATTERNS: &[&str] = &[
    ".git",
    ".DS_Store",
    "Thumbs.db",
    ".obsidian",
    ".trash",
    "node_modules",
    ".vscode",
    ".idea",
    "target",
];

/// Check if a file or directory name should be ignored
fn should_ignore(name: &str) -> bool {
    IGNORED_PATTERNS.contains(&name) || name.starts_with('.')
}

/// Generate or retrieve a stable ID for a path
fn get_or_create_id(path: &str, state: &AppState) -> String {
    let mut path_id_map = state.path_id_map.lock().unwrap();
    let mut id_path_map = state.id_path_map.lock().unwrap();

    if let Some(id) = path_id_map.get(path) {
        return id.clone();
    }

    let id = Uuid::new_v4().to_string();
    path_id_map.insert(path.to_string(), id.clone());
    id_path_map.insert(id.clone(), path.to_string());
    id
}

/// Recursively build the file tree from a directory
fn build_file_tree(dir_path: &Path, state: &AppState) -> Vec<FileNode> {
    let mut entries: Vec<FileNode> = Vec::new();

    if let Ok(dir_entries) = fs::read_dir(dir_path) {
        for entry in dir_entries.flatten() {
            let file_name = entry.file_name().to_string_lossy().to_string();

            if should_ignore(&file_name) {
                continue;
            }

            let path = entry.path();
            let path_str = path.to_string_lossy().to_string();
            let id = get_or_create_id(&path_str, state);
            let is_dir = path.is_dir();

            let children = if is_dir {
                Some(build_file_tree(&path, state))
            } else {
                None
            };

            entries.push(FileNode {
                id,
                name: file_name,
                path: path_str,
                is_dir,
                children,
            });
        }
    }

    // Sort: directories first, then alphabetically
    entries.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            a.name.to_lowercase().cmp(&b.name.to_lowercase())
        } else if a.is_dir {
            std::cmp::Ordering::Less
        } else {
            std::cmp::Ordering::Greater
        }
    });

    entries
}

/// Open a vault directory and return its file tree
#[tauri::command]
fn open_vault(path: String, state: State<AppState>) -> Result<FileNode, String> {
    let dir_path = Path::new(&path);

    if !dir_path.is_dir() {
        return Err(format!("{} is not a valid directory", path));
    }

    // Store the vault path
    {
        let mut vault_path = state.vault_path.lock().unwrap();
        *vault_path = Some(path.clone());
    }

    // Clear old path mappings
    {
        let mut path_id_map = state.path_id_map.lock().unwrap();
        let mut id_path_map = state.id_path_map.lock().unwrap();
        path_id_map.clear();
        id_path_map.clear();
    }

    // Create root node ID
    let root_id = get_or_create_id(&path, state);
    let dir_name = dir_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let children = build_file_tree(dir_path, state);

    Ok(FileNode {
        id: root_id,
        name: dir_name,
        path,
        is_dir: true,
        children: Some(children),
    })
}

/// Read the content of a file
#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {}: {}", path, e))
}

/// Write content to a file
#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    // Ensure parent directory exists
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write {}: {}", path, e))
}

/// Create a new file at the given path
#[tauri::command]
fn create_file(path: String, content: Option<String>) -> Result<(), String> {
    let content = content.unwrap_or_default();
    write_file(path, content)
}

/// Delete a file or directory
#[tauri::command]
fn delete_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        fs::remove_dir_all(p).map_err(|e| format!("Failed to delete directory: {}", e))
    } else {
        fs::remove_file(p).map_err(|e| format!("Failed to delete file: {}", e))
    }
}

/// Rename/move a file or directory
#[tauri::command]
fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    fs::rename(&old_path, &new_path)
        .map_err(|e| format!("Failed to rename {} to {}: {}", old_path, new_path, e))
}

/// Create a new directory
#[tauri::command]
fn create_directory(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create directory {}: {}", path, e))
}

/// Resolve a path to its internal ID
#[tauri::command]
fn resolve_path_id(path: String, state: State<AppState>) -> Result<String, String> {
    let id = get_or_create_id(&path, &state);
    Ok(id)
}

/// Resolve an internal ID back to a path
#[tauri::command]
fn resolve_id_path(id: String, state: State<AppState>) -> Result<String, String> {
    let id_path_map = state.id_path_map.lock().unwrap();
    id_path_map
        .get(&id)
        .cloned()
        .ok_or_else(|| format!("No path found for ID: {}", id))
}

/// Get the current vault path
#[tauri::command]
fn get_vault_path(state: State<AppState>) -> Result<Option<String>, String> {
    let vault_path = state.vault_path.lock().unwrap();
    Ok(vault_path.clone())
}

/// Refresh the file tree without clearing the path-ID mappings.
/// Used by the file watcher to rebuild the tree after FS changes
/// while preserving stable IDs for open tabs and other references.
#[tauri::command]
fn refresh_file_tree(state: State<AppState>) -> Result<FileNode, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault is currently open")?;

    let dir_path = Path::new(&vault_path);
    if !dir_path.is_dir() {
        return Err(format!("{} is not a valid directory", vault_path));
    }

    let root_id = get_or_create_id(&vault_path, &state);
    let dir_name = dir_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| vault_path.clone());

    let children = build_file_tree(dir_path, &state);

    Ok(FileNode {
        id: root_id,
        name: dir_name,
        path: vault_path,
        is_dir: true,
        children: Some(children),
    })
}

// ── File Watcher ──

/// Payload emitted to the frontend on file-system events
#[derive(Debug, Clone, Serialize)]
pub struct FsEvent {
    pub kind: String,
    pub paths: Vec<String>,
}

/// Start a recursive file-system watcher on the current vault.
/// Emits `"fs-event"` to the frontend whenever a file is created,
/// modified, removed, or renamed.
#[tauri::command]
fn start_watcher(state: State<AppState>, app: AppHandle) -> Result<(), String> {
    // Drop any existing watcher first
    {
        let mut w = state.watcher.lock().unwrap();
        *w = None;
    }

    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault is currently open")?;

    let (tx, rx) = mpsc::channel();

    let mut watcher = RecommendedWatcher::new(
        move |res| {
            let _ = tx.send(res);
        },
        NotifyConfig::default(),
    )
    .map_err(|e| format!("Failed to create file watcher: {}", e))?;

    watcher
        .watch(Path::new(&vault_path), RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch vault: {}", e))?;

    // Store the watcher handle (keeps it alive)
    {
        let mut w = state.watcher.lock().unwrap();
        *w = Some(watcher);
    }

    // Background thread that forwards FS events to the frontend
    std::thread::spawn(move || {
        for res in rx {
            match res {
                Ok(event) => {
                    let kind = if event.kind.is_create() {
                        "create"
                    } else if event.kind.is_modify() {
                        "modify"
                    } else if event.kind.is_remove() {
                        "remove"
                    } else if event.kind.is_rename() {
                        "rename"
                    } else {
                        continue;
                    };

                    let paths: Vec<String> = event
                        .paths
                        .iter()
                        .map(|p| p.to_string_lossy().to_string())
                        .collect();

                    // For modify events, only forward .md files (tree refresh
                    // is only needed for create/remove/rename).
                    if kind == "modify" {
                        let has_md = paths.iter().any(|p| p.ends_with(".md"));
                        if !has_md {
                            continue;
                        }
                    }

                    let _ = app.emit(
                        "fs-event",
                        FsEvent {
                            kind: kind.to_string(),
                            paths,
                        },
                    );
                }
                Err(e) => eprintln!("File watch error: {:?}", e),
            }
        }
    });

    Ok(())
}

/// Stop the file-system watcher.
#[tauri::command]
fn stop_watcher(state: State<AppState>) -> Result<(), String> {
    let mut w = state.watcher.lock().unwrap();
    *w = None;
    Ok(())
}

// ── Link Index ──

/// Result of scanning a single file for outgoing links.
#[derive(Debug, Clone, Serialize)]
pub struct FileLinks {
    pub path: String,
    pub links: Vec<String>,
}

/// Walk every `.md` file in the vault and extract outgoing WikiLinks.
/// Returns one entry per file with the list of link targets found.
#[tauri::command]
fn scan_vault_links(state: State<AppState>) -> Result<Vec<FileLinks>, String> {
    let vault_path = state
        .vault_path
        .lock()
        .unwrap()
        .clone()
        .ok_or("No vault is currently open")?;

    let mut results: Vec<FileLinks> = Vec::new();

    // Regex: [[target]], [[target|alias]], [[target#heading]], [[target#^blockid]]
    // Also match ![[embed]] — we treat embeds as links too.
    let link_re = regex::Regex::new(r"!{0,1}\[\[([^\]]+)\]\]").unwrap();

    for entry in WalkDir::new(&vault_path)
        .into_iter()
        .filter_entry(|e| {
            let name = e.file_name().to_string_lossy();
            !should_ignore(&name)
        })
        .flatten()
    {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let path_str = path.to_string_lossy().to_string();
        if !path_str.ends_with(".md") {
            continue;
        }

        if let Ok(content) = fs::read_to_string(path) {
            let mut links: Vec<String> = Vec::new();
            for cap in link_re.captures_iter(&content) {
                if let Some(inner) = cap.get(1) {
                    let target = inner.as_str().trim();
                    // Strip block id: [[note#^blockid]] → note
                    // Strip heading ref: [[note#heading]] → note
                    // Strip alias: [[note|alias]] → note
                    let clean = target
                        .split('#')
                        .next()
                        .unwrap_or(target)
                        .split('|')
                        .next()
                        .unwrap_or(target)
                        .trim()
                        .to_string();
                    if !clean.is_empty() {
                        links.push(clean);
                    }
                }
            }
            results.push(FileLinks {
                path: path_str,
                links,
            });
        }
    }

    Ok(results)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            open_vault,
            read_file,
            write_file,
            create_file,
            delete_path,
            rename_path,
            create_directory,
            resolve_path_id,
            resolve_id_path,
            get_vault_path,
            start_watcher,
            stop_watcher,
            refresh_file_tree,
            scan_vault_links,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
