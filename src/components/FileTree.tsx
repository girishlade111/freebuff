import { useState, useCallback, memo } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FileNode } from "../types";
import { useStore } from "../store/useStore";

interface FileTreeProps {
  node: FileNode;
  depth?: number;
}

interface FileIconProps {
  isDir: boolean;
  isOpen?: boolean;
  name: string;
}

const FileIcon = memo(function FileIcon({ isDir, isOpen, name }: FileIconProps) {
  if (isDir) {
    return (
      <span className="mr-1.5 inline-flex w-4 justify-center text-xs opacity-60">
        {isOpen ? "▾" : "▸"}
      </span>
    );
  }

  const ext = name.split(".").pop()?.toLowerCase();
  let icon = "📄";
  if (ext === "md") icon = "📝";
  else if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext || ""))
    icon = "🖼";
  else if (["json", "yaml", "yml", "toml"].includes(ext || "")) icon = "⚙";
  else if (ext === "pdf") icon = "📕";
  else if (["js", "ts", "tsx", "jsx", "py", "rs", "go"].includes(ext || ""))
    icon = "💻";

  return <span className="mr-1.5 inline-flex w-4 justify-center text-xs">{icon}</span>;
});

function FileTreeNode({ node, depth = 0 }: FileTreeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { openTab, vaultPath } = useStore();

  const handleClick = useCallback(async () => {
    if (node.is_dir) {
      setIsExpanded((prev) => !prev);
      return;
    }

    // Open file in a tab
    try {
      const content: string = await invoke("read_file", { path: node.path });
      openTab(node.path, node.name, content);
    } catch (err) {
      console.error("Failed to open file:", err);
    }
  }, [node, openTab, vaultPath]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Future: show context menu for rename, delete, new file, etc.
    },
    [node]
  );

  const paddingLeft = depth * 16 + 8;

  return (
    <div className="select-none">
      <div
        className="flex cursor-pointer items-center py-0.5 px-2 text-sm
                   hover:bg-bg-hover active:bg-bg-active rounded transition-colors duration-75"
        style={{ paddingLeft: `${paddingLeft}px` }}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        title={node.path}
      >
        <FileIcon isDir={node.is_dir} isOpen={isExpanded} name={node.name} />
        <span className="truncate text-text-primary">{node.name}</span>
      </div>

      {node.is_dir && isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <FileTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ node }: { node: FileNode }) {
  return (
    <div className="py-1">
      <FileTreeNode node={node} depth={0} />
    </div>
  );
}
