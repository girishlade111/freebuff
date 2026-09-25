import yaml from "js-yaml";

// ── Frontmatter delimiter ──
const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

/** A single key-value property parsed from frontmatter */
export interface FrontmatterProperty {
  key: string;
  value: unknown;
}

/** Parsed frontmatter result */
export interface FrontmatterData {
  /** Parsed properties as key-value pairs */
  properties: FrontmatterProperty[];
  /** The raw YAML string between the --- delimiters */
  rawYaml: string;
  /** The byte offset where the markdown body starts (after closing ---) */
  bodyStart: number;
}

/**
 * Parse YAML frontmatter from a markdown string.
 * Returns null if no valid frontmatter block is found.
 */
export function parseFrontmatter(content: string): FrontmatterData | null {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return null;

  const rawYaml = match[1];
  const bodyStart = match[0].length;

  try {
    const parsed = yaml.load(rawYaml);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }

    const properties: FrontmatterProperty[] = Object.entries(parsed).map(
      ([key, value]) => ({ key, value }),
    );

    return { properties, rawYaml, bodyStart };
  } catch {
    return null;
  }
}

/**
 * Serialize properties back into a YAML frontmatter block and
 * prepend it to the markdown body.
 */
export function serializeFrontmatter(
  properties: FrontmatterProperty[],
  body: string,
): string {
  // Build a plain object from properties
  const obj: Record<string, unknown> = {};
  for (const prop of properties) {
    if (prop.key.trim() === "") continue;
    obj[prop.key] = prop.value;
  }

  if (Object.keys(obj).length === 0) {
    // No properties — return just the body
    return body;
  }

  const yamlStr = yaml.dump(obj, {
    lineWidth: -1, // Don't fold long lines
  });

  return `---\n${yamlStr}---\n${body}`;
}

/**
 * Extract the markdown body (everything after the frontmatter block).
 * If no frontmatter exists, returns the full content.
 */
export function getBodyWithoutFrontmatter(content: string): string {
  const match = content.match(FRONTMATTER_RE);
  if (!match) return content;
  return content.slice(match[0].length);
}
