import type { ExtensionContext, ToolCallEvent } from "@earendil-works/pi-coding-agent";

export type BlockedToolCall = { block: true; reason: string };

export type ToolCallGate = (
  ctx: ExtensionContext,
  event: ToolCallEvent,
) => BlockedToolCall | undefined;
