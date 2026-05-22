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

function parseSearchResults(result: any): { total: number; items: { uri: string; snippet: string }[] } {
  const raw = resultRaw(result);
  if (!raw) return { total: 0, items: [] };
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { total: 0, items: [] };
  }
  if (!parsed) return { total: 0, items: [] };
  const arr = Array.isArray(parsed) ? parsed : parsed.results ?? parsed.data ?? [];
  const items = arr.map((r: any) => ({
    uri: r.uri ?? r.path ?? "",
    snippet: (r.snippet ?? r.content ?? "").split(/\r?\n/)[0] ?? "",
  }));
  return { total: items.length, items };
}

export const memorySearch = defineTool({
  name: "memory-search",
  label: "Memory search",
  description:
    "Ranked search across all memory nodes. Tokenizes query, scores matches across URI, content, tags, and disclosure fields, returns results sorted by relevance with snippets.",
  parameters: Type.Object({
    query: Type.String({
      description: "Search keywords (tokenized, multi-term supported).",
    }),
    limit: Type.Optional(
      Type.Number({ description: "Max results (default 10)." }),
    ),
  }),
  execute: async (_id, args) => {
    try {
      const cliArgs = ["memory", "search", args.query];
      if (args.limit !== undefined)
        cliArgs.push("--limit", String(args.limit));
      const result = await runHat(cliArgs);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
  renderCall(args: any, theme: any, context: any) {
    const query = args?.query ?? "";
    return renderCall(theme, context, "Memory search", query);
  },
  renderResult(result: any, opts: any, theme: any, context: any) {
    const expanded = opts?.expanded;
    const isPartial = opts?.isPartial;
    const errored = Boolean(context?.isError || result?.isError);
    const query = context?.args?.query ?? "";
    const call = buildCallLine(theme, "Memory search", query);

    if (isPartial) return renderResultPending(call, theme, "searching");
    if (errored) return renderResultError(call, theme, result, "search failed");

    const { total, items } = parseSearchResults(result);
    const summary = total === 0
      ? theme.fg("muted", "no results")
      : theme.fg("success", `${total} result${total === 1 ? "" : "s"}`);
    let text = `${call}${theme.fg("dim", ` · ${summary}`)}`;

    if (total === 0) return lines(text);

    if (expanded) {
      const limit = 10;
      for (let i = 0; i < Math.min(limit, items.length); i++) {
        const item = items[i]!;
        const connector = i === Math.min(limit, items.length) - 1 && total <= limit ? "└" : "├";
        const glyph = connector === "└" ? "  └ " : "  │ ";
        text += `\n${theme.fg("muted", glyph)}${theme.fg("accent", item.uri)}`;
        if (item.snippet) {
          const snip = item.snippet.length > 100 ? `${item.snippet.slice(0, 99)}…` : item.snippet;
          text += `\n${theme.fg("muted", "    │ ")}${theme.fg("dim", snip)}`;
        }
      }
      if (total > limit)
        text += `\n${theme.fg("muted", `  └ … ${total - limit} more result${total - limit === 1 ? "" : "s"}`)}`;
    } else {
      const first = items[0]!;
      text += `\n${theme.fg("muted", "  └ ")}${theme.fg("accent", first.uri)}`;
      if (first.snippet) {
        const snip = first.snippet.length > 100 ? `${first.snippet.slice(0, 99)}…` : first.snippet;
        text += ` ${theme.fg("dim", snip)}`;
      }
      if (total > 1) text += theme.fg("dim", ` · ${total - 1} more · ctrl+o to expand`);
    }
    return lines(text);
  },
});
