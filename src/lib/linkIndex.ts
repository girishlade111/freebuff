/**
 * Link Index — bidirectional WikiLink mapping.
 *
 * Maintains two maps:
 *   outgoing: filePath → Set of link targets (note names without .md)
 *   incoming: linkTarget → Set of source file paths
 */

// ── Regex that matches [[target]], [[target|alias]], ![[embed]] ──
const WIKILINK_RE = /!{0,1}\[\[([^\]]+)\]\]/g;

// ── Parse a single [[…]] inner string into a clean link target ──
function cleanLinkTarget(inner: string): string | null {
  const target = inner.trim();
  if (!target) return null;

  // Strip block id:  [[note#^blockid]] → note
  // Strip heading:  [[note#heading]]  → note
  // Strip alias:    [[note|alias]]   → note
  const clean = target
    .split("#")[0]
    .split("|")[0]
    .trim();

  return clean || null;
}

// ── Extract all link targets from a markdown string ──
export function extractLinks(content: string): string[] {
  const links: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(WIKILINK_RE.source, "g");

  while ((match = re.exec(content)) !== null) {
    const target = cleanLinkTarget(match[1]);
    if (target) links.push(target);
  }
  return links;
}

// ── Extract unlinked mentions (plain text matching a note's filename) ──
export function extractUnlinkedMentions(
  content: string,
  noteNames: string[],
): string[] {
  const mentions: string[] = [];
  for (const name of noteNames) {
    // Only match whole-word occurrences that are NOT inside [[ ]]
    const wordRe = new RegExp(
      `(?<!\\[\\[)\\b${escapeRegex(name)}\\b(?!\\]\\])`,
      "i",
    );
    if (wordRe.test(content)) {
      mentions.push(name);
    }
  }
  return mentions;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ── Build the full bidirectional index from scan results ──
export interface FileLinks {
  path: string;
  links: string[];
}

export interface LinkIndex {
  outgoing: Map<string, string[]>; // filePath → link targets
  incoming: Map<string, Set<string>>; // linkTarget → source filePaths
}

export function buildLinkIndex(files: FileLinks[]): LinkIndex {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, Set<string>>();

  for (const file of files) {
    outgoing.set(file.path, file.links);

    for (const target of file.links) {
      if (!incoming.has(target)) {
        incoming.set(target, new Set());
      }
      incoming.get(target)!.add(file.path);
    }
  }

  return { outgoing, incoming };
}

// ── Incrementally update the index for a single file ──
export function updateLinkIndex(
  index: LinkIndex,
  filePath: string,
  newContent: string,
): LinkIndex {
  const outgoing = new Map(index.outgoing);
  const incoming = new Map(
    [...index.incoming].map(([k, v]) => [k, new Set(v)]),
  );

  // Remove old outgoing links from incoming map
  const oldLinks = outgoing.get(filePath) || [];
  for (const target of oldLinks) {
    const sources = incoming.get(target);
    if (sources) {
      sources.delete(filePath);
      if (sources.size === 0) incoming.delete(target);
    }
  }

  // Parse new content and update both maps
  const newLinks = extractLinks(newContent);
  outgoing.set(filePath, newLinks);

  for (const target of newLinks) {
    if (!incoming.has(target)) {
      incoming.set(target, new Set());
    }
    incoming.get(target)!.add(filePath);
  }

  return { outgoing, incoming };
}

// ── Remove a file from the index entirely ──
export function removeFileFromIndex(
  index: LinkIndex,
  filePath: string,
): LinkIndex {
  const outgoing = new Map(index.outgoing);
  const incoming = new Map(
    [...index.incoming].map(([k, v]) => [k, new Set(v)]),
  );

  const oldLinks = outgoing.get(filePath) || [];
  for (const target of oldLinks) {
    const sources = incoming.get(target);
    if (sources) {
      sources.delete(filePath);
      if (sources.size === 0) incoming.delete(target);
    }
  }

  outgoing.delete(filePath);

  return { outgoing, incoming };
}
