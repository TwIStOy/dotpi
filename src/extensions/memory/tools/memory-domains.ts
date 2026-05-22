import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runHat } from "../cli-runner.js";
import { jsonError, jsonResult } from "../tool-result.js";
import {
  buildCallLine,
  lines,
  emptyComponent,
  renderResultError,
  renderResultPending,
  resultRaw,
} from "./render.js";

function parseDomainsResult(result: any): { total: number; items: string[] } {
  const raw = resultRaw(result);
  if (!raw) return { total: 0, items: [] };
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : parsed.domains ?? parsed.data ?? [];
    const items = arr.map((d: any) => {
      if (typeof d === "string") return d;
      const name = d.name ?? d.domain ?? d.id ?? "?";
      const count = d.count ?? d.node_count;
      return count !== undefined ? `${name} (${count})` : name;
    });
    return { total: items.length, items };
  } catch {
    return { total: 0, items: [] };
  }
}

export const memoryDomains = defineTool({
  name: "memory-domains",
  label: "Memory domains",
  description: "List all memory domains with their node counts.",
  parameters: Type.Object({}),
  execute: async () => {
    try {
      const result = await runHat(["memory", "domains"]);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
  renderCall(_args: any, theme: any, context: any) {
    if (!context?.executionStarted || !context?.isPartial) return emptyComponent;
    return lines(`${theme.fg("warning", "● ")}${theme.fg("text", theme.bold("Memory domains"))}`);
  },
  renderResult(result: any, opts: any, theme: any, context: any) {
    const expanded = opts?.expanded;
    const isPartial = opts?.isPartial;
    const errored = Boolean(context?.isError || result?.isError);
    const call = `${theme.fg("accent", "● ")}${theme.fg("text", theme.bold("Memory domains"))}`;

    if (isPartial) return renderResultPending(call, theme, "loading domains");
    if (errored) return renderResultError(call, theme, result, "domains failed");

    const { total, items } = parseDomainsResult(result);
    const summary = total === 0
      ? theme.fg("muted", "none")
      : theme.fg("success", `${total} domain${total === 1 ? "" : "s"}`);
    let text = `${call}${theme.fg("dim", ` · ${summary}`)}`;

    if (total === 0) return lines(text);

    if (expanded) {
      text += `\n${items
        .map((item: string) => `${theme.fg("muted", "  │ ")}${theme.fg("dim", item)}`)
        .join("\n")}`;
    } else {
      const first = items[0]!;
      text += `\n${theme.fg("muted", "  └ ")}${theme.fg("dim", first)}`;
      if (total > 1) text += theme.fg("dim", ` · ${total - 1} more · ctrl+o to expand`);
    }
    return lines(text);
  },
});
