import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { bracketMatching, indentOnInput, foldGutter, foldKeymap } from "@codemirror/language";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { getEditorTheme } from "../editor/theme";
import { livePreview } from "../editor/livePreview";
import { obsidianSyntax } from "../editor/obsidianSyntax";

interface MarkdownEditorProps {
  content: string;
  onChange: (value: string) => void;
  onSave: () => void;
}

/**
 * A full-featured CodeMirror 6 Markdown editor with live preview.
 *
 * Features:
 * - Markdown syntax highlighting with language data
 * - Live preview: renders markdown visually (bold, italic, headings, etc.)
 * - History (undo/redo)
 * - Bracket matching, auto-close brackets
 * - Search/replace
 * - Line numbers, fold gutters
 * - Active line highlighting
 * - Custom FreeBuff theme (light + dark)
 * - Ctrl+S save shortcut
 */
export default function MarkdownEditor({ content, onChange, onSave }: MarkdownEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  // Keep refs up to date without re-creating the editor
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  // Save command for keymap
  const saveKeymap = useCallback(() => {
    onSaveRef.current();
    return true;
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const state = EditorState.create({
      doc: content,
      extensions: [
        // Line numbers and gutter
        lineNumbers(),
        highlightActiveLineGutter(),
        foldGutter(),

        // History (undo/redo)
        history(),

        // Bracket matching and auto-close
        bracketMatching(),
        closeBrackets(),
        indentOnInput(),

        // Search
        highlightSelectionMatches(),

        // Autocomplete
        autocompletion(),

        // Active line
        highlightActiveLine(),

        // Markdown language with data
        markdown({ base: markdownLanguage, codeLanguages: languages }),

        // Live preview decorations
        livePreview,

        // Obsidian-flavoured syntax (WikiLinks, tags, embeds)
        obsidianSyntax,

        // Theme
        ...getEditorTheme(),

        // Keymaps
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          indentWithTab,
          // Ctrl/Cmd+S to save
          { key: "Mod-s", run: saveKeymap },
        ]),

        // Update listener: propagate content changes
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            const newDoc = update.state.doc.toString();
            onChangeRef.current(newDoc);
          }
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount — we use refs for callbacks
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external content changes (e.g., from file watcher) into the editor
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const currentDoc = view.state.doc.toString();
    if (currentDoc !== content) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: content,
        },
      });
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-hidden"
    />
  );
}
