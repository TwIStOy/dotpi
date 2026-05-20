import type { ExtensionContext, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import { bashAgenixCommandGate } from "./gates/bash-agenix-command.js";
import { blockedToolNamesGate } from "./gates/blocked-tool-names.js";
import { readBlockedPrefixesGate } from "./gates/read-blocked-prefixes.js";
import type { BlockedToolCall, ToolCallGate } from "./types.js";

const TOOL_CALL_GATES: ToolCallGate[] = [
  readBlockedPrefixesGate,
  bashAgenixCommandGate,
  blockedToolNamesGate,
  // Add more gate functions here (order matters: first match wins).
];

export function evaluateToolCallGates(
  ctx: ExtensionContext,
  event: ToolCallEvent,
): BlockedToolCall | undefined {
  for (const gate of TOOL_CALL_GATES) {
    const blocked = gate(ctx, event);
    if (blocked) return blocked;
  }
  return undefined;
}