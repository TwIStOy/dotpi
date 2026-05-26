import {
  type Component,
  truncateToWidth,
  wrapTextWithAnsi,
  matchesKey,
} from "@earendil-works/pi-tui";
import { getAgentConversation } from "../agent-runner.js";
import type { AgentRecord } from "../types.js";
import { formatDuration, formatTokens } from "../formatting.js";
import { getLifetimeTotal } from "../usage.js";

export class ConversationViewer implements Component {
  private lines: string[] = [];
  private scrollOffset = 0;
  private maxVisible = 20;
  private done: (() => void) | null = null;

  constructor(
    private record: AgentRecord,
    private onDone: () => void,
  ) {
    if (record.session) {
      const conversation = getAgentConversation(record.session);
      this.lines = conversation.split("\n");
    }
  }

  invalidate(): void {}

  render(width: number): string[] {
    const header = buildHeader(this.record, width);
    const separator = "─".repeat(Math.min(width, 60));
    const visibleLines = this.lines.slice(
      this.scrollOffset,
      this.scrollOffset + this.maxVisible,
    );
    const wrapped: string[] = [];
    for (const line of visibleLines) {
      wrapped.push(...wrapTextWithAnsi(line, width - 2));
    }

    const footer = separator;
    const _scrollInfo =
      this.lines.length > this.maxVisible
        ? ` [${this.scrollOffset + 1}-${Math.min(this.scrollOffset + this.maxVisible, this.lines.length)}/${this.lines.length}] ↑↓ scroll · Esc close`
        : " · Esc close";

    return [header, separator, ...wrapped, footer];
  }

  handleInput(data: string): void {
    if (matchesKey(data, "escape") || matchesKey(data, "q")) {
      this.onDone();
      return;
    }
    if (matchesKey(data, "up") || matchesKey(data, "k")) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1);
      return;
    }
    if (matchesKey(data, "down") || matchesKey(data, "j")) {
      this.scrollOffset = Math.min(
        Math.max(0, this.lines.length - this.maxVisible),
        this.scrollOffset + 1,
      );
      return;
    }
    if (matchesKey(data, "pageUp")) {
      this.scrollOffset = Math.max(0, this.scrollOffset - this.maxVisible);
      return;
    }
    if (matchesKey(data, "pageDown")) {
      this.scrollOffset = Math.min(
        Math.max(0, this.lines.length - this.maxVisible),
        this.scrollOffset + this.maxVisible,
      );
      return;
    }
  }
}

function buildHeader(record: AgentRecord, width: number): string {
  const tokens = getLifetimeTotal(record.lifetimeUsage);
  const tokenStr = tokens > 0 ? ` | ${formatTokens(tokens)}` : "";
  const duration = formatDuration(record.startedAt, record.completedAt);
  return truncateToWidth(
    `Agent: ${record.type} (${record.id.slice(0, 8)}) | ${record.status} | ${record.toolUses} tools | ${duration}${tokenStr}`,
    width,
  );
}
