import type { ExtensionContext, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { BLOCKED_TOOL_NAMES } from "../settings.js";
import type { BlockedToolCall } from "../types.js";

/**
 * Blocks tool calls whose names appear in {@link BLOCKED_TOOL_NAMES}.
 * Default list is empty; add e.g. `memory-delete` in settings to deny deletes.
 */
export function blockedToolNamesGate(
  _ctx: ExtensionContext,
  event: ToolCallEvent,
): BlockedToolCall | undefined {
  if (!BLOCKED_TOOL_NAMES.length) return undefined;
  if (!BLOCKED_TOOL_NAMES.includes(event.toolName)) return undefined;
  return {
    block: true,
    reason: `Tool "${event.toolName}" is blocked by dotpi permission-gate (BLOCKED_TOOL_NAMES).`,
  };
}