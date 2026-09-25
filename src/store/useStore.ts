import { create } from "zustand";
import type { FileNode, Tab, ViewMode } from "../types";
import type { LinkIndex } from "../lib/linkIndex";

interface AppState {
  // Vault state
  vaultPath: string | null;
  fileTree: FileNode | null;

  // Tab state
  tabs: Tab[];
  activeTabId: string | null;

  // Link index state
  linkIndex: LinkIndex | null;

  // UI state
  sidebarWidth: number;
  isSidebarOpen: boolean;
  viewMode: ViewMode;

  // Actions — Vault
  setVault: (path: string, tree: FileNode) => void;
  setFileTree: (tree: FileNode) => void;

  // Actions — Tabs
  openTab: (filePath: string, fileName: string, content: string) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  updateTabContent: (tabId: string, content: string) => void;
  markTabSaved: (tabId: string) => void;

  // Actions — Link Index
  setLinkIndex: (index: LinkIndex) => void;

  // Actions — File Watcher
  syncTabFromDisk: (filePath: string, content: string) => void;

  // Actions — UI
  setSidebarWidth: (width: number) => void;
  toggleSidebar: () => void;
  setViewMode: (mode: ViewMode) => void;
}

export const useStore = create<AppState>((set, get) => ({
  // Vault state
  vaultPath: null,
  fileTree: null,

  // Tab state
  tabs: [],
  activeTabId: null,

  // Link index state
  linkIndex: null,

  // UI state
  sidebarWidth: 260,
  isSidebarOpen: true,
  viewMode: "editor",

  // Vault actions
  setVault: (path, tree) =>
    set({
      vaultPath: path,
      fileTree: tree,
      tabs: [],
      activeTabId: null,
    }),

  setFileTree: (tree) => set({ fileTree: tree }),

  // Tab actions
  openTab: (filePath, fileName, content) => {
    const { tabs } = get();

    // Check if already open
    const existing = tabs.find((t) => t.filePath === filePath);
    if (existing) {
      set({ activeTabId: existing.id });
      return;
    }

    const newTab: Tab = {
      id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filePath,
      fileName,
      content,
      isDirty: false,
    };

    set({
      tabs: [...tabs, newTab],
      activeTabId: newTab.id,
    });
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    const filtered = tabs.filter((t) => t.id !== tabId);
    let newActive = activeTabId;

    if (activeTabId === tabId) {
      const closedIndex = tabs.findIndex((t) => t.id === tabId);
      if (filtered.length === 0) {
        newActive = null;
      } else {
        // Activate the tab to the left, or the first remaining tab
        const newIndex = Math.min(closedIndex, filtered.length - 1);
        newActive = filtered[newIndex].id;
      }
    }

    set({
      tabs: filtered,
      activeTabId: newActive,
    });
  },

  setActiveTab: (tabId) => set({ activeTabId: tabId }),

  updateTabContent: (tabId, content) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, content, isDirty: true } : t
      ),
    })),

  markTabSaved: (tabId) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.id === tabId ? { ...t, isDirty: false } : t
      ),
    })),

  // Link index actions
  setLinkIndex: (index) => set({ linkIndex: index }),

  // File watcher actions
  syncTabFromDisk: (filePath, content) =>
    set((state) => ({
      tabs: state.tabs.map((t) =>
        t.filePath === filePath && !t.isDirty ? { ...t, content } : t
      ),
    })),

  // UI actions
  setSidebarWidth: (width) => set({ sidebarWidth: width }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setViewMode: (mode) => set({ viewMode: mode }),
}));
