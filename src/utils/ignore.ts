/// Patterns for files/directories that should be hidden from the UI
const IGNORED_PATTERNS: readonly string[] = [
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

/**
 * Check if a file or directory name should be ignored
 * in the file tree display.
 */
export function shouldIgnore(name: string): boolean {
  if (IGNORED_PATTERNS.includes(name)) return true;
  if (name.startsWith(".") && name !== ".") return true;
  return false;
}

/**
 * Get the file extension from a path, lowercase, without the dot.
 * Returns empty string if no extension.
 */
export function getFileExtension(filePath: string): string {
  const parts = filePath.split(".");
  if (parts.length <= 1) return "";
  return parts[parts.length - 1].toLowerCase();
}

/**
 * Check if a file is a Markdown file.
 */
export function isMarkdownFile(filePath: string): boolean {
  return getFileExtension(filePath) === "md";
}

/**
 * Get a display-friendly relative path.
 * Strips the vault root prefix.
 */
export function getRelativePath(fullPath: string, vaultRoot: string): string {
  if (fullPath.startsWith(vaultRoot)) {
    let rel = fullPath.slice(vaultRoot.length);
    if (rel.startsWith("/") || rel.startsWith("\\")) {
      rel = rel.slice(1);
    }
    return rel;
  }
  return fullPath;
}
