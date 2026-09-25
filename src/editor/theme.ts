import { EditorView } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags } from "@lezer/highlight";

/**
 * Light theme for the Markdown editor matching FreeBuff's CSS variables.
 */
const freebuffLightHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.6em", fontWeight: "bold", color: "#1a1a1a" },
  { tag: tags.heading2, fontSize: "1.4em", fontWeight: "bold", color: "#1a1a1a" },
  { tag: tags.heading3, fontSize: "1.2em", fontWeight: "bold", color: "#1a1a1a" },
  { tag: tags.heading4, fontSize: "1.1em", fontWeight: "bold", color: "#1a1a1a" },
  { tag: tags.strong, fontWeight: "bold", color: "#1a1a1a" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#1a1a1a" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#999" },
  { tag: tags.link, color: "#7c3aed", textDecoration: "underline" },
  { tag: tags.url, color: "#7c3aed" },
  { tag: tags.monospace, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "0.9em", backgroundColor: "#f3f4f6", padding: "1px 4px", borderRadius: "3px" },
  { tag: tags.meta, color: "#999" },
  { tag: tags.comment, color: "#999", fontStyle: "italic" },
  { tag: tags.keyword, color: "#7c3aed" },
  { tag: tags.string, color: "#059669" },
  { tag: tags.number, color: "#d97706" },
  { tag: tags.bool, color: "#d97706" },
  { tag: tags.atom, color: "#d97706" },
  { tag: tags.processingInstruction, color: "#999" },
]);

const freebuffLightTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "15px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
  },
  ".cm-content": {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    lineHeight: "1.7",
    padding: "24px 32px",
    maxWidth: "800px",
    margin: "0 auto",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--accent-color)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "rgba(124, 58, 237, 0.15) !important",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-muted)",
    border: "none",
    paddingRight: "8px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--bg-hover)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--bg-hover)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--bg-tertiary)",
    color: "var(--text-muted)",
    border: "none",
  },
  ".cm-matchingBracket": {
    backgroundColor: "rgba(124, 58, 237, 0.15)",
    outline: "1px solid rgba(124, 58, 237, 0.3)",
  },
}, { dark: false });

/**
 * Dark theme for the Markdown editor.
 */
const freebuffDarkHighlight = HighlightStyle.define([
  { tag: tags.heading1, fontSize: "1.6em", fontWeight: "bold", color: "#e0e0e0" },
  { tag: tags.heading2, fontSize: "1.4em", fontWeight: "bold", color: "#e0e0e0" },
  { tag: tags.heading3, fontSize: "1.2em", fontWeight: "bold", color: "#e0e0e0" },
  { tag: tags.heading4, fontSize: "1.1em", fontWeight: "bold", color: "#e0e0e0" },
  { tag: tags.strong, fontWeight: "bold", color: "#e0e0e0" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#e0e0e0" },
  { tag: tags.strikethrough, textDecoration: "line-through", color: "#666" },
  { tag: tags.link, color: "#a78bfa", textDecoration: "underline" },
  { tag: tags.url, color: "#a78bfa" },
  { tag: tags.monospace, fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: "0.9em", backgroundColor: "#2d2d2d", padding: "1px 4px", borderRadius: "3px" },
  { tag: tags.meta, color: "#666" },
  { tag: tags.comment, color: "#666", fontStyle: "italic" },
  { tag: tags.keyword, color: "#a78bfa" },
  { tag: tags.string, color: "#34d399" },
  { tag: tags.number, color: "#fbbf24" },
  { tag: tags.bool, color: "#fbbf24" },
  { tag: tags.atom, color: "#fbbf24" },
  { tag: tags.processingInstruction, color: "#666" },
]);

const freebuffDarkTheme = EditorView.theme({
  "&": {
    height: "100%",
    fontSize: "15px",
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-primary)",
  },
  ".cm-content": {
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
    lineHeight: "1.7",
    padding: "24px 32px",
    maxWidth: "800px",
    margin: "0 auto",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "var(--accent-color)",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "rgba(139, 92, 246, 0.2) !important",
  },
  ".cm-gutters": {
    backgroundColor: "var(--bg-primary)",
    color: "var(--text-muted)",
    border: "none",
    paddingRight: "8px",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "var(--bg-hover)",
  },
  ".cm-activeLine": {
    backgroundColor: "var(--bg-hover)",
  },
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--bg-tertiary)",
    color: "var(--text-muted)",
    border: "none",
  },
  ".cm-matchingBracket": {
    backgroundColor: "rgba(139, 92, 246, 0.2)",
    outline: "1px solid rgba(139, 92, 246, 0.4)",
  },
}, { dark: true });

/**
 * Detect if the page is in dark mode and return the appropriate theme.
 */
export function getEditorTheme() {
  const isDark = document.documentElement.classList.contains("dark");
  return isDark
    ? [freebuffDarkTheme, syntaxHighlighting(freebuffDarkHighlight)]
    : [freebuffLightTheme, syntaxHighlighting(freebuffLightHighlight)];
}
