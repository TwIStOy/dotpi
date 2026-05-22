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

function parseSearchResult(result: any): { total: number; items: { id: string; title: string }[] } {
  const raw = resultRaw(result);
  if (!raw) return { total: 0, items: [] };
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : parsed.results ?? parsed.data ?? [];
    const items = arr.map((e: any) => ({
      id: e.id ?? e.timestamp ?? "",
      title: e.title ?? "",
    }));
    return { total: items.length, items };
  } catch {
    return { total: 0, items: [] };
  }
}

export const journalSearch = defineTool({
  name: "journal-search",
  label: "Journal search",
  description:
    "Search journal entries by text content or tags with pagination. Returns summaries sorted by recency.",
  parameters: Type.Object({
    text: Type.Optional(
      Type.String({
        description: "Substring to search for in title and body.",
      }),
    ),
    tags: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Filter by tags (entries matching ANY tag are included).",
      }),
    ),
    limit: Type.Optional(
      Type.Number({
        description: "Maximum entries to return (default: 20).",
      }),
    ),
    offset: Type.Optional(
      Type.Number({
        description: "Number of entries to skip for pagination (default: 0).",
      }),
    ),
  }),
  execute: async (_id, args) => {
    try {
      const cliArgs = ["journal", "search"];
      if (args.text) cliArgs.push("--text", args.text);
      if (args.tags?.length) cliArgs.push("--tags", args.tags.join(","));
      if (args.limit !== undefined)
        cliArgs.push("--limit", String(args.limit));
      if (args.offset !== undefined)
        cliArgs.push("--offset", String(args.offset));
      const result = await runHat(cliArgs);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
  renderCall(args: any, theme: any, context: any) {
    const query = args?.text ?? (args?.tags?.length ? args.tags.join(",") : "");
    return renderCall(theme, context, "Journal search", query || "(all)");
  },
  renderResult(result: any, opts: any, theme: any, context: any) {
    const expanded = opts?.expanded;
    const isPartial = opts?.isPartial;
    const errored = Boolean(context?.isError || result?.isError);
    const args = context?.args ?? {};
    const query = args.text ?? (args.tags?.length ? args.tags.join(",") : "");
    const call = buildCallLine(theme, "Journal search", query || "(all)");

    if (isPartial) return renderResultPending(call, theme, "searching");
    if (errored) return renderResultError(call, theme, result, "search failed");

    const { total, items } = parseSearchResult(result);
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
        text += `\n${theme.fg("muted", glyph)}${theme.fg("dim", item.id)}`;
        if (item.title) {
          const snip = item.title.length > 100 ? `${item.title.slice(0, 99)}…` : item.title;
          text += ` ${theme.fg("dim", snip)}`;
        }
      }
      if (total > limit)
        text += `\n${theme.fg("muted", `  └ … ${total - limit} more result${total - limit === 1 ? "" : "s"}`)}`;
    } else {
      const first = items[0]!;
      text += `\n${theme.fg("muted", "  └ ")}${theme.fg("dim", first.id)}`;
      if (first.title) text += ` ${theme.fg("dim", first.title.length > 80 ? `${first.title.slice(0, 79)}…` : first.title)}`;
      if (total > 1) text += theme.fg("dim", ` · ${total - 1} more · ctrl+o to expand`);
    }
    return lines(text);
  },
});
