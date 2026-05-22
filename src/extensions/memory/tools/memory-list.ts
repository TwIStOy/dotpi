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

function parseListResult(result: any): { total: number; lines: string[] } {
  const raw = resultRaw(result);
  if (!raw) return { total: 0, lines: [] };
  const split = raw.split(/\r?\n/).filter((l) => l.trim() !== "");
  return { total: split.length, lines: split };
}

export const memoryList = defineTool({
  name: "memory-list",
  label: "Memory list",
  description:
    "List all memory nodes as a tree structure. Optionally filter by domain.",
  parameters: Type.Object({
    domain: Type.Optional(
      Type.String({
        description: "List only nodes in this domain (e.g. 'core', 'notes').",
      }),
    ),
  }),
  execute: async (_id, args) => {
    try {
      const cliArgs = ["memory", "list"];
      if (args.domain) cliArgs.push(args.domain);
      const result = await runHat(cliArgs);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
  renderCall(args: any, theme: any, context: any) {
    const domain = args?.domain ?? "";
    return renderCall(theme, context, "Memory list", domain || "(all)");
  },
  renderResult(result: any, opts: any, theme: any, context: any) {
    const expanded = opts?.expanded;
    const isPartial = opts?.isPartial;
    const errored = Boolean(context?.isError || result?.isError);
    const domain = context?.args?.domain ?? "";
    const call = buildCallLine(theme, "Memory list", domain || "(all)");

    if (isPartial) return renderResultPending(call, theme, "listing");
    if (errored) return renderResultError(call, theme, result, "list failed");

    const { total, lines: allLines } = parseListResult(result);
    const summary = total === 0
      ? theme.fg("muted", "empty")
      : theme.fg("success", `${total} node${total === 1 ? "" : "s"}`);
    let text = `${call}${theme.fg("dim", ` · ${summary}`)}`;

    if (total === 0) return lines(text);

    if (expanded) {
      const limit = 20;
      text += `\n${allLines.slice(0, limit)
        .map((line: string) => `${theme.fg("muted", "  │ ")}${theme.fg("dim", line)}`)
        .join("\n")}`;
      if (total > limit) {
        const more = total - limit;
        text += `\n${theme.fg("muted", `  │ … ${more} more node${more === 1 ? "" : "s"}`)}`;
      }
    } else {
      const firstLine = allLines[0] ?? "";
      text += `\n${theme.fg("muted", "  └ ")}${theme.fg("dim", firstLine)}`;
      if (total > 1) text += theme.fg("dim", ` · ${total - 1} more · ctrl+o to expand`);
    }
    return lines(text);
  },
});
