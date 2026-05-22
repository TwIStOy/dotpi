import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runHat } from "../cli-runner.js";
import { jsonError, jsonResult } from "../tool-result.js";
import {
  buildCallLine,
  lines,
  renderCall,
  renderResultError,
  renderResultPending,
  resultRaw,
} from "./render.js";

function parseHistoryResult(result: any): { total: number; lines: string[] } {
  const raw = resultRaw(result);
  if (!raw) return { total: 0, lines: [] };
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : parsed.versions ?? parsed.data ?? [];
    const items = arr.map((v: any) => {
      const action = v.action ?? v.type ?? "?";
      const ts = v.timestamp ?? v.id ?? v.created_at ?? "";
      return `${action} ${ts}`;
    });
    return { total: items.length, lines: items };
  } catch {
    const split = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
    return { total: split.length, lines: split };
  }
}

export const memoryHistory = defineTool({
  name: "memory-history",
  label: "Memory history",
  description:
    "View version history for a specific memory node. Returns snapshots of past content with timestamps and action types.",
  parameters: Type.Object({
    uri: Type.String({
      description:
        "Node URI in domain://path format (e.g. 'core://agent/identity').",
    }),
    limit: Type.Optional(
      Type.Number({ description: "Max entries to return (default 10)." }),
    ),
  }),
  execute: async (_id, args) => {
    try {
      const cliArgs = ["memory", "versions", args.uri];
      if (args.limit !== undefined)
        cliArgs.push("--limit", String(args.limit));
      const result = await runHat(cliArgs);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
  renderCall(args: any, theme: any, context: any) {
    return renderCall(theme, context, "Memory history", args?.uri ?? "");
  },
  renderResult(result: any, opts: any, theme: any, context: any) {
    const expanded = opts?.expanded;
    const isPartial = opts?.isPartial;
    const errored = Boolean(context?.isError || result?.isError);
    const uri = context?.args?.uri ?? "";
    const call = buildCallLine(theme, "Memory history", uri);

    if (isPartial) return renderResultPending(call, theme, "loading history");
    if (errored) return renderResultError(call, theme, result, "history failed");

    const { total, lines: allLines } = parseHistoryResult(result);
    const summary = total === 0
      ? theme.fg("muted", "no versions")
      : theme.fg("success", `${total} version${total === 1 ? "" : "s"}`);
    let text = `${call}${theme.fg("dim", ` · ${summary}`)}`;

    if (total === 0) return lines(text);

    if (expanded) {
      const limit = 15;
      text += `\n${allLines.slice(0, limit)
        .map((line: string) => `${theme.fg("muted", "  │ ")}${theme.fg("dim", line)}`)
        .join("\n")}`;
      if (total > limit) {
        const more = total - limit;
        text += `\n${theme.fg("muted", `  │ … ${more} more version${more === 1 ? "" : "s"}`)}`;
      }
    } else {
      const firstLine = allLines[0] ?? "";
      text += `\n${theme.fg("muted", "  └ ")}${theme.fg("dim", firstLine)}`;
      if (total > 1) text += theme.fg("dim", ` · ${total - 1} more · ctrl+o to expand`);
    }
    return lines(text);
  },
});
