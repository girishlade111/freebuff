import { useState, useCallback, useRef, useEffect } from "react";
import { useStore } from "../store/useStore";
import {
  parseFrontmatter,
  serializeFrontmatter,
  getBodyWithoutFrontmatter,
  type FrontmatterProperty,
} from "../lib/frontmatter";

/**
 * Editable properties panel for YAML frontmatter.
 * Renders a key-value table above the editor when the active note has frontmatter.
 */
export default function FrontmatterPanel() {
  const activeTabId = useStore((s) => s.activeTabId);
  const tabs = useStore((s) => s.tabs);
  const updateTabContent = useStore((s) => s.updateTabContent);

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Parse frontmatter from the active tab's content
  const parsed = activeTab ? parseFrontmatter(activeTab.content) : null;
  const properties = parsed?.properties ?? [];
  const body = activeTab ? getBodyWithoutFrontmatter(activeTab.content) : "";

  // Track the properties we're editing locally
  const [localProps, setLocalProps] = useState<FrontmatterProperty[]>([]);
  const isSyncingRef = useRef(false);

  // Sync local state when the active tab changes
  useEffect(() => {
    if (parsed) {
      isSyncingRef.current = true;
      setLocalProps([...parsed.properties]);
      // Reset after the effect to avoid triggering the save effect
      requestAnimationFrame(() => {
        isSyncingRef.current = false;
      });
    } else {
      setLocalProps([]);
    }
  }, [activeTabId, parsed?.rawYaml]); // Only sync when tab or raw YAML changes

  // Push local changes back to the editor content
  useEffect(() => {
    if (!activeTab || isSyncingRef.current) return;
    if (localProps.length === 0 && !parsed) return;

    const newContent = serializeFrontmatter(localProps, body);
    if (newContent !== activeTab.content) {
      updateTabContent(activeTab.id, newContent);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localProps]);

  // ── Handlers ──
  const updateValue = useCallback(
    (index: number, newValue: unknown) => {
      setLocalProps((prev) =>
        prev.map((p, i) => (i === index ? { ...p, value: newValue } : p)),
      );
    },
    [],
  );

  const updateKey = useCallback(
    (index: number, newKey: string) => {
      setLocalProps((prev) =>
        prev.map((p, i) => (i === index ? { ...p, key: newKey } : p)),
      );
    },
    [],
  );

  const removeProperty = useCallback((index: number) => {
    setLocalProps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const addProperty = useCallback(() => {
    setLocalProps((prev) => [...prev, { key: "", value: "" }]);
  }, []);

  if (!activeTab) return null;

  // No frontmatter yet — show "Add properties" button
  if (!parsed) {
    const handleAddFrontmatter = () => {
      const body = activeTab.content;
      const newContent = `---\ntitle: "${activeTab.fileName.replace(/\.md$/, "")}"\n---\n${body}`;
      updateTabContent(activeTab.id, newContent);
    };

    return (
      <div className="border-b border-border bg-bg-secondary">
        <button
          onClick={handleAddFrontmatter}
          className="flex w-full items-center gap-2 px-4 py-2 text-xs
                     text-text-muted hover:bg-bg-hover hover:text-accent transition-colors"
        >
          + Add properties
        </button>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-bg-secondary">
      {/* Header */}
      <button
        onClick={() => setIsCollapsed((c) => !c)}
        className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold
                   uppercase tracking-wider text-text-muted hover:bg-bg-hover transition-colors"
      >
        <span className="text-[10px]">{isCollapsed ? "▸" : "▾"}</span>
        <span>Properties</span>
        <span className="opacity-50">({properties.length})</span>
      </button>

      {/* Properties table */}
      {!isCollapsed && (
        <div className="px-4 pb-3">
          <table className="w-full text-sm">
            <tbody>
              {localProps.map((prop, idx) => (
                <tr key={idx} className="group">
                  {/* Key */}
                  <td className="pr-2 py-0.5 w-[40%]">
                    <input
                      type="text"
                      value={prop.key}
                      onChange={(e) => updateKey(idx, e.target.value)}
                      className="w-full rounded bg-transparent border border-transparent
                                 px-2 py-0.5 text-xs font-medium text-accent
                                 hover:border-border focus:border-accent focus:outline-none
                                 transition-colors"
                      placeholder="key"
                    />
                  </td>
                  {/* Value */}
                  <td className="pr-1 py-0.5">
                    <PropertyValueInput
                      value={prop.value}
                      onChange={(v) => updateValue(idx, v)}
                    />
                  </td>
                  {/* Remove */}
                  <td className="py-0.5 w-6">
                    <button
                      onClick={() => removeProperty(idx)}
                      className="opacity-0 group-hover:opacity-100 text-text-muted
                                 hover:text-red-400 transition-opacity text-xs"
                      title="Remove property"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Add property button */}
          <button
            onClick={addProperty}
            className="mt-1 text-xs text-text-muted hover:text-accent transition-colors"
          >
            + Add property
          </button>
        </div>
      )}
    </div>
  );
}

// ── Value input that adapts to type ──

function PropertyValueInput({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  // Checkbox (boolean)
  if (typeof value === "boolean") {
    return (
      <input
        type="checkbox"
        checked={value}
        onChange={(e) => onChange(e.target.checked)}
        className="accent-accent"
      />
    );
  }

  // Array → comma-separated text
  if (Array.isArray(value)) {
    return (
      <input
        type="text"
        value={value.join(", ")}
        onChange={(e) =>
          onChange(
            e.target.value
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean),
          )
        }
        className="w-full rounded bg-transparent border border-transparent
                   px-2 py-0.5 text-xs text-text-secondary
                   hover:border-border focus:border-accent focus:outline-none
                   transition-colors"
        placeholder="value (comma-separated)"
      />
    );
  }

  // Number
  if (typeof value === "number") {
    return (
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        className="w-full rounded bg-transparent border border-transparent
                   px-2 py-0.5 text-xs text-text-secondary font-mono
                   hover:border-border focus:border-accent focus:outline-none
                   transition-colors"
      />
    );
  }

  // Default: text string
  return (
    <input
      type="text"
      value={String(value ?? "")}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded bg-transparent border border-transparent
                 px-2 py-0.5 text-xs text-text-secondary
                 hover:border-border focus:border-accent focus:outline-none
                 transition-colors"
      placeholder="value"
    />
  );
}
