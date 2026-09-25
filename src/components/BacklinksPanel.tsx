import { useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useStore } from "../store/useStore";

/**
 * Backlinks panel — shows all notes that link to the currently active note.
 * Displayed in the sidebar when a note is open.
 */
export default function BacklinksPanel() {
  const activeTabId = useStore((s) => s.activeTabId);
  const tabs = useStore((s) => s.tabs);
  const linkIndex = useStore((s) => s.linkIndex);

  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Derive the note name (without .md) from the active tab
  const activeNoteName = useMemo(() => {
    if (!activeTab) return null;
    const name = activeTab.fileName;
    return name.endsWith(".md") ? name.slice(0, -3) : name;
  }, [activeTab]);

  // Get incoming links for the active note
  const backlinks = useMemo(() => {
    if (!activeNoteName || !linkIndex) return [];
    const sources = linkIndex.incoming.get(activeNoteName);
    if (!sources) return [];
    return [...sources].sort();
  }, [activeNoteName, linkIndex]);

  // Get outgoing links from the active note
  const outgoingLinks = useMemo(() => {
    if (!activeTab || !linkIndex) return [];
    const targets = linkIndex.outgoing.get(activeTab.filePath);
    if (!targets) return [];
    return [...targets].sort();
  }, [activeTab, linkIndex]);

  if (!activeTab) return null;

  const handleOpenFile = async (filePath: string) => {
    try {
      const content = await invoke<string>("read_file", { path: filePath });
      const fileName = filePath.split(/[/\\]/).pop() || filePath;
      useStore.getState().openTab(filePath, fileName, content);
    } catch (err) {
      console.error("Failed to open linked file:", err);
    }
  };

  return (
    <div className="border-t border-border">
      {/* Backlinks (incoming) */}
      <div className="px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
          Backlinks ({backlinks.length})
        </h3>
        {backlinks.length === 0 ? (
          <p className="text-xs text-text-muted opacity-60 italic">No backlinks</p>
        ) : (
          <ul className="space-y-0.5">
            {backlinks.map((filePath) => {
              const name = filePath.split(/[/\\]/).pop() || filePath;
              return (
                <li key={filePath}>
                  <button
                    onClick={() => handleOpenFile(filePath)}
                    className="w-full text-left rounded px-2 py-0.5 text-xs text-text-secondary
                               hover:bg-bg-hover hover:text-text-primary transition-colors truncate"
                    title={filePath}
                  >
                    📝 {name}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Outgoing links */}
      {outgoingLinks.length > 0 && (
        <div className="px-3 py-2 border-t border-border">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1.5">
            Outgoing ({outgoingLinks.length})
          </h3>
          <ul className="space-y-0.5">
            {outgoingLinks.map((target) => (
              <li key={target} className="text-xs text-accent truncate px-2 py-0.5">
                → {target}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
