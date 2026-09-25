import { useCallback } from "react";
import { useStore } from "../store/useStore";

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useStore();

  const handleClose = useCallback(
    (e: React.MouseEvent, tabId: string) => {
      e.stopPropagation();
      closeTab(tabId);
    },
    [closeTab]
  );

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center overflow-x-auto border-b border-border bg-bg-secondary">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        return (
          <div
            key={tab.id}
            className={`group flex cursor-pointer items-center gap-1.5 border-r border-border
                        px-3 py-1.5 text-sm transition-colors duration-75
                        ${
                          isActive
                            ? "bg-bg-primary text-text-primary"
                            : "text-text-secondary hover:bg-bg-hover hover:text-text-primary"
                        }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {/* Dirty indicator */}
            {tab.isDirty && (
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 flex-shrink-0" />
            )}

            <span className="max-w-[140px] truncate">{tab.fileName}</span>

            {/* Close button */}
            <button
              className="ml-1 flex h-4 w-4 items-center justify-center rounded
                         opacity-0 group-hover:opacity-100 hover:bg-bg-active
                         transition-opacity text-text-muted"
              onClick={(e) => handleClose(e, tab.id)}
              title="Close tab"
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
