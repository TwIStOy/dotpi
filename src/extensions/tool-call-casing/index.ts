import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const INSTALL_GUARD = Symbol.for("dotpi.tool-call-casing.installed");

/**
 * Some models call built-in file tools with wrong casing (`Read` / `Write`).
 * Pi resolves tools by exact name before `tool_call` hooks run, so those calls
 * would fail as "tool not found". Normalize on the finalized assistant message
 * (same object reference used for execution) so lookup succeeds.
 */
export default function initToolCallCasing(pi: ExtensionAPI): void {
  const guard = pi as unknown as Record<symbol, boolean>;
  if (guard[INSTALL_GUARD]) return;
  guard[INSTALL_GUARD] = true;

  pi.on("message_end", (event): void => {
    if (event.message.role !== "assistant") return;
    const content = event.message.content;
    if (!Array.isArray(content)) return;
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const block = part as { type?: string; name?: string };
      if (block.type !== "toolCall" || typeof block.name !== "string") continue;
      const lower = block.name.toLowerCase();
      if (lower === "read" || lower === "write") {
        block.name = lower;
      }
    }
  });
}
