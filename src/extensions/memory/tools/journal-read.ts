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

function parseJournalEntry(result: any): string {
  const raw = resultRaw(result);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.content === "string" ? parsed.content : "";
  } catch {
    return "";
  }
}

export const journalRead = defineTool({
  name: "journal-read",
  label: "Journal read",
  description: "Read a specific journal entry by its timestamp ID.",
  parameters: Type.Object({
    id: Type.String({
      description:
        'Timestamp ID of the entry (e.g., "20260310-143025-001").',
    }),
  }),
  execute: async (_id, args) => {
    try {
      const result = await runHat(["journal", "read", args.id]);
      if (!result) {
        return jsonResult({
          error: `Journal entry "${args.id}" not found.`,
        });
      }
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
  renderCall(args: any, theme: any, context: any) {
    return renderCall(theme, context, "Journal read", args?.id ?? "");
  },
  renderResult(result: any, opts: any, theme: any, context: any) {
    const expanded = opts?.expanded;
    const isPartial = opts?.isPartial;
    const errored = Boolean(context?.isError || result?.isError);
    const id = context?.args?.id ?? "";
    const call = buildCallLine(theme, "Journal read", id);

    if (isPartial) return renderResultPending(call, theme, "reading");
    if (errored) return renderResultError(call, theme, result, "read failed");

    const entryContent = parseJournalEntry(result);
    const allLines = entryContent.split(/\r?\n/);
    const count = allLines.length;
    const summary = `${count} line${count === 1 ? "" : "s"}`;
    let text = `${call}${theme.fg("dim", ` · ${theme.fg("success", summary)}`)}`;

    if (count === 0) return lines(text);

    if (expanded) {
      const limit = 20;
      text += `\n${allLines.slice(0, limit)
        .map((line: string) => `${theme.fg("muted", "  │ ")}${theme.fg("dim", line)}`)
        .join("\n")}`;
      if (count > limit)
        text += `\n${theme.fg("muted", `  │ … ${count - limit} more line(s)`)}`;
    } else {
      const firstLine = allLines[0] ?? "";
      text += `\n${theme.fg("muted", "  └ ")}${theme.fg("dim", firstLine.length > 120 ? `${firstLine.slice(0, 119)}…` : firstLine)}`;
      if (count > 1) text += theme.fg("dim", " · ctrl+o to expand");
    }
    return lines(text);
  },
});
