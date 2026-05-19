import type { AgentRecord, LifetimeUsage } from "../types.js";
import { getLifetimeTotal, getSessionContextPercent } from "../usage.js";

export function textResult(msg: string, details?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text: msg }],
    details: details as any,
  };
}

export function formatLifetimeTokens(o: {
  lifetimeUsage: LifetimeUsage;
}): string {
  const t = getLifetimeTotal(o.lifetimeUsage);
  return t > 0 ? `${(t / 1000).toFixed(1)}k` : "";
}

export function getStatusNote(status: string): string {
  switch (status) {
    case "aborted":
      return " (aborted — max turns exceeded, output may be incomplete)";
    case "steered":
      return " (wrapped up — reached turn limit)";
    case "stopped":
      return " (stopped by user)";
    default:
      return "";
  }
}

export function buildResultSummary(record: AgentRecord): string {
  const tokens = formatLifetimeTokens(record);
  const contextPercent = getSessionContextPercent(record.session);
  const parts = [`Tool uses: ${record.toolUses}`];
  if (tokens) parts.push(tokens);
  if (contextPercent !== null)
    parts.push(`Context: ${Math.round(contextPercent)}%`);
  if (record.compactionCount)
    parts.push(`Compactions: ${record.compactionCount}`);
  const duration = (record.completedAt ?? Date.now()) - record.startedAt;
  parts.push(`Duration: ${(duration / 1000).toFixed(1)}s`);
  return parts.join(" | ");
}
