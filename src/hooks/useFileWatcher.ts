import { useEffect, useRef, useCallback } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../store/useStore";
import type { FileNode } from "../types";

/** Payload emitted by the Rust file watcher */
interface FsEvent {
  kind: "create" | "modify" | "remove" | "rename";
  paths: string[];
}

/**
 * Watches the vault directory for external file-system changes and syncs
 * them into the React state:
 *  - create / remove / rename  → debounced full tree refresh
 *  - modify                    → re-reads the file and syncs into open
 *                                 tabs that have no unsaved changes
 */
export function useFileWatcher() {
  const vaultPath = useStore((s) => s.vaultPath);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlistenRef = useRef<UnlistenFn | null>(null);

  /** Re-read the vault tree from the Rust backend (preserves stable IDs) */
  const refreshTree = useCallback(async () => {
    const currentVault = useStore.getState().vaultPath;
    if (!currentVault) return;
    try {
      const tree = await invoke<FileNode>("refresh_file_tree");
      useStore.getState().setFileTree(tree);
    } catch (err) {
      console.error("Failed to refresh file tree:", err);
    }
  }, []);

  /** Debounce helper – coalesces rapid FS events into a single refresh */
  const debouncedRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshTree();
      refreshTimerRef.current = null;
    }, 300);
  }, [refreshTree]);

  /** Re-read a single file and push content into the matching tab */
  const syncModifiedFile = useCallback(async (filePath: string) => {
    const { tabs } = useStore.getState();
    const tab = tabs.find((t) => t.filePath === filePath);
    // Don't overwrite content the user has unsaved edits for
    if (!tab || tab.isDirty) return;
    try {
      const content = await invoke<string>("read_file", { path: filePath });
      useStore.getState().syncTabFromDisk(filePath, content);
    } catch (err) {
      console.error("Failed to sync modified file:", err);
    }
  }, []);

  useEffect(() => {
    if (!vaultPath) {
      // No vault open – ensure watcher is stopped and listener cleaned up
      unlistenRef.current?.();
      unlistenRef.current = null;
      return;
    }

    let active = true;

    (async () => {
      // Tell the Rust backend to start watching the vault directory
      await invoke("start_watcher");

      // Listen for FS events forwarded from the Rust side
      unlistenRef.current = await listen<FsEvent>("fs-event", (event) => {
        if (!active) return;
        const { kind, paths } = event.payload;

        if (kind === "create" || kind === "remove" || kind === "rename") {
          debouncedRefresh();
        } else if (kind === "modify") {
          for (const p of paths) {
            syncModifiedFile(p);
          }
        }
      });
    })().catch(console.error);

    return () => {
      active = false;
      unlistenRef.current?.();
      unlistenRef.current = null;
      invoke("stop_watcher").catch(() => {});
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [vaultPath, debouncedRefresh, syncModifiedFile]);
}
