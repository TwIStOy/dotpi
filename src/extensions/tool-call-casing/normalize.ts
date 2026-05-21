/** Map lowercase tool name → canonical name from the active tool list. */
export function buildCaseInsensitiveToolNameMap(
  activeToolNames: readonly string[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const name of activeToolNames) {
    const key = name.toLowerCase();
    if (!map.has(key)) {
      map.set(key, name);
    }
  }
  return map;
}

/**
 * Rewrite assistant toolCall block names when they differ only by casing
 * from a registered active tool (e.g. `Read` → `read`).
 */
export function normalizeToolCallNamesInMessage(
  message: { role: string; content?: unknown },
  canonicalByLowercase: Map<string, string>,
): void {
  if (message.role !== "assistant") return;
  const content = message.content;
  if (!Array.isArray(content)) return;

  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    const block = part as { type?: string; name?: string };
    if (block.type !== "toolCall" || typeof block.name !== "string") continue;

    const canonical = canonicalByLowercase.get(block.name.toLowerCase());
    if (canonical !== undefined) {
      block.name = canonical;
    }
  }
}