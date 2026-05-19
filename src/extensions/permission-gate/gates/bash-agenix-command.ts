import type { ExtensionContext, ToolCallEvent } from "@earendil-works/pi-coding-agent";
import {
  BASH_AGENIX_PATTERN,
  rejectedBashAgenixMessage,
} from "../constants.js";
import type { BlockedToolCall } from "../types.js";

/**
 * Blocks `bash` when the command string references `/run/agenix/` (agenix
 * decrypted secrets), matching shell-side guards from other stacks.
 */
export function bashAgenixCommandGate(
  _ctx: ExtensionContext,
  event: ToolCallEvent,
): BlockedToolCall | undefined {
  if (event.toolName !== "bash") return undefined;
  const command =
    typeof event.input.command === "string" ? event.input.command : "";
  if (BASH_AGENIX_PATTERN.test(command)) {
    return { block: true, reason: rejectedBashAgenixMessage() };
  }
  return undefined;
}
