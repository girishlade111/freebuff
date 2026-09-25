import { useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "./store/useStore";
import { useFileWatcher } from "./hooks/useFileWatcher";
import { useLinkIndex } from "./hooks/useLinkIndex";
import Sidebar from "./components/Sidebar";
import TabBar from "./components/TabBar";
import MarkdownEditor from "./components/MarkdownEditor";
import FrontmatterPanel from "./components/FrontmatterPanel";

function EditorPane() {
  const { tabs, activeTabId, updateTabContent, markTabSaved } = useStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleSave = useCallback(() => {
    if (!activeTab) return;
    invoke("write_file", {
      path: activeTab.filePath,
      content: activeTab.content,
    })
      .then(() => markTabSaved(activeTab.id))
      .catch(console.error);
  }, [activeTab, markTabSaved]);

  if (!activeTab) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted">
        <div className="mb-4 text-6xl opacity-20">📝</div>
        <p className="text-lg font-medium mb-1">No file open</p>
        <p className="text-sm opacity-60">
          Select a file from the sidebar or press{" "}
          <kbd className="rounded border border-border bg-bg-tertiary px-1.5 py-0.5 text-xs font-mono">
            Ctrl+P
          </kbd>{" "}
          to search
        </p>
      </div>
    );
  }

  const lineCount = activeTab.content.split("\n").length;
  const charCount = activeTab.content.length;

  return (
    <div className="flex flex-col h-full">
      {/* Frontmatter properties panel */}
      <FrontmatterPanel />

      <div className="flex-1 overflow-hidden">
        <MarkdownEditor
          content={activeTab.content}
          onChange={(value) => updateTabContent(activeTab.id, value)}
          onSave={handleSave}
        />
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-border bg-bg-secondary px-4 py-1 text-xs text-text-muted">
        <span>{activeTab.fileName}</span>
        <span>{lineCount} lines · {charCount} chars</span>
      </div>
    </div>
  );
}

export default function App() {
  const { isSidebarOpen, toggleSidebar } = useStore();

  // Watch vault directory for external FS changes
  useFileWatcher();

  // Build and maintain the bidirectional link index
  useLinkIndex();

  // Auto-load vault on mount if one was previously opened
  useEffect(() => {
    invoke<string | null>("get_vault_path")
      .then((path) => {
        if (path) {
          invoke("open_vault", { path }).then((tree) => {
            useStore.getState().setVault(path, tree as import("./types").FileNode);
          });
        }
      })
      .catch(console.error);
  }, []);

  // Global keyboard shortcut: Ctrl+Shift+F to toggle sidebar
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar]);

  return (
    <div className="flex h-screen bg-bg-primary">
      {/* Sidebar toggle button */}
      <button
        onClick={toggleSidebar}
        className="fixed top-2 left-2 z-50 rounded p-1.5 text-text-muted
                   hover:bg-bg-hover hover:text-text-primary transition-colors"
        title="Toggle sidebar (Ctrl+Shift+B)"
      >
        {isSidebarOpen ? "◀" : "▶"}
      </button>

      {/* Sidebar */}
      <div
        className="h-full flex-shrink-0 transition-all duration-200"
        style={{ width: isSidebarOpen ? "260px" : "0px" }}
      >
        <Sidebar />
      </div>

      {/* Main content area */}
      <main className="flex flex-col flex-1 min-w-0 h-full">
        {/* Tab bar */}
        <TabBar />

        {/* Editor / content area */}
        <div className="flex-1 overflow-hidden">
          <EditorPane />
        </div>
      </main>
    </div>
  );
}
