import { ViewPlugin, Decoration, DecorationSet, ViewUpdate, EditorView, WidgetType } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";

// ── Widget: Bold text ──
class BoldWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  toDOM() {
    const span = document.createElement("span");
    span.style.fontWeight = "bold";
    span.textContent = this.text;
    return span;
  }
  eq(other: BoldWidget) { return this.text === other.text; }
}

// ── Widget: Italic text ──
class ItalicWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  toDOM() {
    const span = document.createElement("span");
    span.style.fontStyle = "italic";
    span.textContent = this.text;
    return span;
  }
  eq(other: ItalicWidget) { return this.text === other.text; }
}

// ── Widget: Strikethrough text ──
class StrikeWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  toDOM() {
    const span = document.createElement("span");
    span.style.textDecoration = "line-through";
    span.style.color = "var(--text-muted)";
    span.textContent = this.text;
    return span;
  }
  eq(other: StrikeWidget) { return this.text === other.text; }
}

// ── Widget: Inline code ──
class InlineCodeWidget extends WidgetType {
  constructor(readonly text: string) { super(); }
  toDOM() {
    const code = document.createElement("code");
    code.style.fontFamily = "'JetBrains Mono', 'Fira Code', monospace";
    code.style.fontSize = "0.9em";
    code.style.backgroundColor = "var(--bg-tertiary)";
    code.style.padding = "1px 5px";
    code.style.borderRadius = "3px";
    code.style.color = "var(--accent-color)";
    code.textContent = this.text;
    return code;
  }
  eq(other: InlineCodeWidget) { return this.text === other.text; }
}

// ── Widget: Horizontal rule ──
class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement("hr");
    hr.style.border = "none";
    hr.style.borderTop = "1px solid var(--border-color)";
    hr.style.margin = "16px 0";
    return hr;
  }
}

// ── Live Preview Plugin ──
class MarkdownPreviewState {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = this.buildDecorations(view);
  }

  update(update: ViewUpdate) {
    if (update.docChanged || update.viewportChanged) {
      this.decorations = this.buildDecorations(update.view);
    }
  }

  buildDecorations(view: EditorView): DecorationSet {
    const builder = new RangeSetBuilder<Decoration>();
    const tree = syntaxTree(view.state);

    tree.iterate({
      enter: (node) => {
        const name = node.type.name;

        // ── Bold: StrongEmphasis ──
        if (name === "StrongEmphasis") {
          // Find the inner text between ** markers
          const from = node.from;
          const to = node.to;
          const raw = view.state.doc.sliceString(from, to);
          // Remove ** markers
          const text = raw.replace(/^\*\*(.+)\*\*$/, "$1").replace(/^__(.+)__$/, "$1");
          if (text) {
            builder.add(from, to, Decoration.replace({ widget: new BoldWidget(text) }));
          }
          return false;
        }

        // ── Italic: Emphasis (but not StrongEmphasis) ──
        if (name === "Emphasis" && node.node.parent?.type.name !== "StrongEmphasis") {
          const from = node.from;
          const to = node.to;
          const raw = view.state.doc.sliceString(from, to);
          const text = raw.replace(/^\*(.+)\*$/, "$1").replace(/^_(.+)_$/, "$1");
          if (text) {
            builder.add(from, to, Decoration.replace({ widget: new ItalicWidget(text) }));
          }
          return false;
        }

        // ── Strikethrough ──
        if (name === "Strikethrough") {
          const from = node.from;
          const to = node.to;
          const raw = view.state.doc.sliceString(from, to);
          const text = raw.replace(/^~~(.+)~~$/, "$1");
          if (text) {
            builder.add(from, to, Decoration.replace({ widget: new StrikeWidget(text) }));
          }
          return false;
        }

        // ── Inline code ──
        if (name === "InlineCode") {
          const from = node.from;
          const to = node.to;
          const raw = view.state.doc.sliceString(from, to);
          const text = raw.replace(/^`(.+)`$/, "$1");
          builder.add(from, to, Decoration.replace({ widget: new InlineCodeWidget(text) }));
          return false;
        }

        // ── Heading decorations ──
        if (name === "ATXHeading1" || name === "ATXHeading2" || name === "ATXHeading3" ||
            name === "ATXHeading4" || name === "ATXHeading5" || name === "ATXHeading6") {
          const level = parseInt(name.replace("ATXHeading", ""));
          const from = node.from;
          const to = node.to;
          const line = view.state.doc.lineAt(from);
          const lineText = line.text;
          // Hide the # prefix
          const hashMatch = lineText.match(/^(#{1,6})\s/);
          if (hashMatch) {
            builder.add(from, from + hashMatch[0].length - 1, Decoration.mark({
              attributes: {
                style: "display: none"
              }
            }));
            // Add heading style to the text after the hashes
            const textStart = from + hashMatch[0].length;
            const fontSize = [0, "1.6em", "1.4em", "1.2em", "1.1em", "1.0em", "1.0em"][level];
            builder.add(textStart, to, Decoration.mark({
              attributes: {
                style: `font-size: ${fontSize}; font-weight: bold; color: var(--text-primary);`
              }
            }));
          }
          return false;
        }

        // ── Horizontal rule ──
        if (name === "HorizontalRule") {
          builder.add(node.from, node.to, Decoration.replace({ widget: new HrWidget() }));
          return false;
        }

        // ── Blockquote ──
        if (name === "Blockquote") {
          builder.add(node.from, node.from + 1, Decoration.mark({
            attributes: {
              style: "border-left: 3px solid var(--accent-color); padding-left: 12px; margin-left: -16px; opacity: 0.6;"
            }
          }));
          return false;
        }

        // ── Unordered list bullet ──
        if (name === "ListBullet") {
          builder.add(node.from, node.to, Decoration.replace({
            widget: new (class extends WidgetType {
              toDOM() {
                const span = document.createElement("span");
                span.style.display = "inline-block";
                span.style.width = "6px";
                span.style.height = "6px";
                span.style.borderRadius = "50%";
                span.style.backgroundColor = "var(--accent-color)";
                span.style.marginRight = "8px";
                span.style.verticalAlign = "middle";
                return span;
              }
            })()
          }));
          return false;
        }
      }
    });

    return builder.finish();
  }
}

/**
 * CodeMirror extension for Markdown live preview.
 * Hides raw syntax and renders styled HTML in its place.
 */
export const livePreview = ViewPlugin.fromClass(MarkdownPreviewState, {
  decorations: (v) => v.decorations,
});
