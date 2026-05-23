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

function extractNodeContent(result: any): string {
  const raw = resultRaw(result);
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed?.content === "string" ? parsed.content : "";
  } catch {
    return "";
  }
}

export const memoryRead = defineTool({
  name: "memory-read",
  label: "Memory read",
  description:
    "Read a memory node by URI. Supports regular URIs (e.g. 'core://agent/identity') and system URIs (e.g. 'system://boot', 'system://index', 'system://glossary').",
  parameters: Type.Object({
    uri: Type.String({
      description:
        "Memory URI (e.g. 'core://agent/identity') or system URI (e.g. 'system://boot').",
    }),
  }),
  execute: async (_id, args) => {
    try {
      const result = await runHat(["memory", "read", args.uri]);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
  renderCall(args: any, theme: any, context: any) {
    return renderCall(theme, context, "Memory read", args?.uri ?? "");
  },
  renderResult(result: any, opts: any, theme: any, context: any) {
    const expanded = opts?.expanded;
    const isPartial = opts?.isPartial;
    const errored = Boolean(context?.isError || result?.isError);
    const uri = context?.args?.uri ?? "";
    const call = buildCallLine(theme, "Memory read", uri);

    if (isPartial) return renderResultPending(call, theme, "reading");
    if (errored) return renderResultError(call, theme, result, "read failed");

    const nodeContent = extractNodeContent(result);
    const allLines = nodeContent ? nodeContent.split(/\r?\n/) : [];
    const count = allLines.length;
    const firstLine = allLines[0] ?? "";
    const summary = `${count} line${count === 1 ? "" : "s"}`;
    let text = `${call}${theme.fg("dim", ` · ${theme.fg("success", summary)}`)}`;

    if (count === 0) return lines(text);

    if (expanded) {
      const limit = 20;
      text += `\n${allLines.slice(0, limit)
        .map((line) => `${theme.fg("muted", "  │ ")}${theme.fg("dim", line)}`)
        .join("\n")}`;
      if (count > limit)
        text += `\n${theme.fg("muted", `  │ … ${count - limit} more line(s)`)}`;
    } else {
      text += `\n${theme.fg("muted", "  └ ")}${theme.fg("dim", firstLine.length > 120 ? `${firstLine.slice(0, 119)}…` : firstLine)}`;
      if (count > 1) text += theme.fg("dim", " · ctrl+o to expand");
    }
    return lines(text);
  },
});
