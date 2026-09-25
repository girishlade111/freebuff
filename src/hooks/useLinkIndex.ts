import { useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../store/useStore";
import {
  buildLinkIndex,
  updateLinkIndex,
  type LinkIndex,
  type FileLinks,
} from "../lib/linkIndex";

// Re-export for external use
export type { LinkIndex } from "../lib/linkIndex";

/**
 * Builds and maintains the bidirectional link index.
 *
 * - On vault load: calls Rust `scan_vault_links` and builds the full index.
 * - On tab content change: incrementally updates the index for that file.
 * - On tab close / file delete: removes the file from the index.
 */
export function useLinkIndex() {
  const vaultPath = useStore((s) => s.vaultPath);
  const indexRef = useRef<LinkIndex>({ outgoing: new Map(), incoming: new Map() });

  /** Build the full index from Rust scan results */
  const buildFullIndex = useCallback(async () => {
    try {
      const files = await invoke<FileLinks[]>("scan_vault_links");
      indexRef.current = buildLinkIndex(files);
      useStore.getState().setLinkIndex(indexRef.current);
    } catch (err) {
      console.error("Failed to build link index:", err);
    }
  }, []);

  /** Incrementally update a single file's links */
  const updateFileLinks = useCallback((filePath: string, content: string) => {
    indexRef.current = updateLinkIndex(indexRef.current, filePath, content);
    useStore.getState().setLinkIndex(indexRef.current);
  }, []);

  // Build index when vault opens
  useEffect(() => {
    if (vaultPath) {
      buildFullIndex();
    } else {
      indexRef.current = { outgoing: new Map(), incoming: new Map() };
      useStore.getState().setLinkIndex(indexRef.current);
    }
  }, [vaultPath, buildFullIndex]);

  // Incrementally update link index when tab content changes
  const prevContentsRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const tabs = useStore.getState().tabs;
    for (const tab of tabs) {
      const prev = prevContentsRef.current.get(tab.filePath);
      if (prev !== undefined && prev !== tab.content) {
        updateFileLinks(tab.filePath, tab.content);
      }
      prevContentsRef.current.set(tab.filePath, tab.content);
    }
    // Track closed tabs so we can detect reopens
    const openPaths = new Set(tabs.map((t) => t.filePath));
    for (const [path] of prevContentsRef.current) {
      if (!openPaths.has(path)) {
        prevContentsRef.current.delete(path);
      }
    }
  });
}
