import { useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../store/useStore";
import FileTree from "./FileTree";
import BacklinksPanel from "./BacklinksPanel";

export default function Sidebar() {
  const {
    vaultPath,
    fileTree,
    setVault,
    isSidebarOpen,
  } = useStore();

  const handleOpenVault = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: "Open Vault",
      });

      if (selected) {
        const path = typeof selected === "string" ? selected : selected;
        const tree = await invoke("open_vault", { path });
        setVault(path as string, tree as import("../types").FileNode);
      }
    } catch (err) {
      console.error("Failed to open vault:", err);
    }
  }, [setVault]);

  if (!isSidebarOpen) return null;

  return (
    <aside className="flex h-full flex-col border-r border-border bg-bg-secondary overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
          {vaultPath ? "Files" : "No Vault"}
        </h2>
        <button
          onClick={handleOpenVault}
          className="rounded px-2 py-0.5 text-xs font-medium text-text-secondary
                     hover:bg-bg-hover hover:text-text-primary transition-colors"
          title="Open a folder as vault"
        >
          Open
        </button>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {fileTree ? (
          <FileTree node={fileTree} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full px-6 text-center">
            <div className="mb-3 text-3xl opacity-30">📂</div>
            <p className="text-sm text-text-muted mb-3">
              Open a folder to start your vault
            </p>
            <button
              onClick={handleOpenVault}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white
                         hover:bg-accent-hover transition-colors"
            >
              Open Vault
            </button>
          </div>
        )}
      </div>

      {/* Backlinks panel (shown when a note is active) */}
      <BacklinksPanel />
    </aside>
  );
}
