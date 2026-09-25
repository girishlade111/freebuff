import {
  ViewPlugin,
  Decoration,
  DecorationSet,
  ViewUpdate,
  EditorView,
  WidgetType,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";

// ──────────────────────────────────────────────
//  Regex patterns
// ──────────────────────────────────────────────

/**
 * Matches Obsidian syntax tokens in a single pass per line:
 *   ![[embed]]          – embed (must be tested before plain [[)
 *   [[note#^blockid]]   – block reference
 *   [[note|alias]]      – wiki-link with alias
 *   [[note]]            – plain wiki-link
 *   #tag                – tag (not inside code / URL)
 *   #parent/child       – nested tag
 */
const OBSIDIAN_RE =
  /!\[\[[^\]]*\]\]|\[\[[^\]]*#[^\]]*\]\]|\[\[[^\]]*\|[^\]]*\]\]|\[\[[^\]]*\]\]|#[\w][\w\/\-]*/;

// ──────────────────────────────────────────────
//  Widget types
// ──────────────────────────────────────────────

/** Parse the inner content of [[…]] into { target, alias, blockId } */
function parseWikiLink(inner: string): {
  target: string;
  alias: string | null;
  blockId: string | null;
} {
  // Check for block reference: [[note#^blockid]]
  const blockMatch = inner.match(/^([^#]+)#\^(.+)$/);
  if (blockMatch) {
    return { target: blockMatch[1], alias: null, blockId: blockMatch[2] };
  }

  // Check for heading reference: [[note#heading]]
  const headingMatch = inner.match(/^([^#]+)#(.+)$/);
  if (headingMatch) {
    return { target: headingMatch[1], alias: headingMatch[2], blockId: null };
  }

  // Check for alias: [[note|alias]]
  const aliasMatch = inner.match(/^([^|]+)\|(.+)$/);
  if (aliasMatch) {
    return { target: aliasMatch[1], alias: aliasMatch[2], blockId: null };
  }

  return { target: inner, alias: null, blockId: null };
}

/** Extract the display text from an embed target */
function parseEmbedTarget(inner: string): string {
  // Remove file extension for display (e.g., "image.png" → "image")
  const name = inner.replace(/\.[^.]+$/, "");
  return name;
}

// ── WikiLink Widget ──
class WikiLinkWidget extends WidgetType {
  constructor(
    readonly target: string,
    readonly alias: string | null,
    readonly blockId: string | null,
  ) {
    super();
  }

  eq(other: WikiLinkWidget) {
    return (
      this.target === other.target &&
      this.alias === other.alias &&
      this.blockId === other.blockId
    );
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-obsidian-link";
    span.setAttribute("data-target", this.target);
    if (this.blockId) {
      span.setAttribute("data-block-id", this.blockId);
    }

    const displayText = this.alias ?? this.target;
    span.textContent = displayText;

    if (this.blockId) {
      const badge = document.createElement("span");
      badge.className = "cm-obsidian-link-badge";
      badge.textContent = "^";
      span.appendChild(badge);
    }

    return span;
  }
}

// ── Embed Widget ──
class EmbedWidget extends WidgetType {
  constructor(readonly target: string) {
    super();
  }

  eq(other: EmbedWidget) {
    return this.target === other.target;
  }

  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-obsidian-embed";
    span.setAttribute("data-target", this.target);

    const icon = document.createElement("span");
    icon.className = "cm-obsidian-embed-icon";
    icon.textContent = "⊕";

    const label = document.createElement("span");
    label.textContent = parseEmbedTarget(this.target);

    span.appendChild(icon);
    span.appendChild(label);
    return span;
  }
}

// ──────────────────────────────────────────────
//  ViewPlugin
// ──────────────────────────────────────────────

class ObsidianSyntaxState {
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

    for (const { from, to } of view.visibleRanges) {
      const text = view.state.doc.sliceString(from, to);
      const regex = new RegExp(OBSIDIAN_RE.source, "g");
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const start = from + match.index;
        const end = start + match[0].length;
        const raw = match[0];

        // ── Embed: ![[…]] ──
        if (raw.startsWith("![[") && raw.endsWith("]]")) {
          const inner = raw.slice(3, -2).trim();
          if (inner) {
            builder.add(
              start,
              end,
              Decoration.replace({ widget: new EmbedWidget(inner) }),
            );
          }
          continue;
        }

        // ── WikiLink: [[…]] ──
        if (raw.startsWith("[[") && raw.endsWith("]]")) {
          const inner = raw.slice(2, -2).trim();
          if (inner) {
            const { target, alias, blockId } = parseWikiLink(inner);
            builder.add(
              start,
              end,
              Decoration.replace({
                widget: new WikiLinkWidget(target, alias, blockId),
              }),
            );
          }
          continue;
        }

        // ── Tag: #tag or #parent/child ──
        if (raw.startsWith("#")) {
          // Skip if preceded by alphanumeric (e.g., inside a URL or heading)
          if (start > 0) {
            const prev = view.state.doc.sliceString(start - 1, start);
            if (/[a-zA-Z0-9]/.test(prev)) continue;
          }

          builder.add(
            start,
            end,
            Decoration.mark({ class: "cm-obsidian-tag" }),
          );
        }
      }
    }

    return builder.finish();
  }
}

/**
 * CodeMirror extension that decorates Obsidian-flavoured Markdown:
 *   [[WikiLink]], [[WikiLink|alias]], [[Note#^blockid]]
 *   ![[embed]]
 *   #tag, #parent/child
 */
export const obsidianSyntax = ViewPlugin.fromClass(ObsidianSyntaxState, {
  decorations: (v) => v.decorations,
});
