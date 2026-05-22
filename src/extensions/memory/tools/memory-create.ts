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
} from "./render.js";

export const memoryCreate = defineTool({
  name: "memory-create",
  label: "Memory create",
  description:
    "Create a new child memory node under a parent URI. URI format: domain://path (e.g. 'core://agent').",
  parameters: Type.Object({
    parent_uri: Type.String({
      description:
        "Parent URI (e.g. 'core://agent'). Use 'core://' for domain root.",
    }),
    content: Type.String({
      description: "Memory content (supports Markdown).",
    }),
    priority: Type.Optional(
      Type.Number({
        description: "Priority: 0 (highest) to 9 (lowest). Default 5.",
      }),
    ),
    title: Type.Optional(
      Type.String({
        description:
          "Path segment name (a-z, 0-9, _, -). Auto-assigned if omitted.",
      }),
    ),
    disclosure: Type.Optional(
      Type.String({
        description: "When to recall: trigger condition for this memory.",
      }),
    ),
  }),
  execute: async (_id, args) => {
    try {
      const cliArgs = ["memory", "create", args.parent_uri, args.content];
      if (args.priority !== undefined)
        cliArgs.push("--priority", String(args.priority));
      if (args.title) cliArgs.push("--title", args.title);
      if (args.disclosure) cliArgs.push("--disclosure", args.disclosure);
      const result = await runHat(cliArgs);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
  renderCall(args: any, theme: any, context: any) {
    const title = args?.title ?? "";
    return renderCall(
      theme,
      context,
      "Memory create",
      args?.parent_uri ?? "",
      title ? ` → ${title}` : undefined,
    );
  },
  renderResult(result: any, opts: any, theme: any, context: any) {
    const expanded = opts?.expanded;
    const isPartial = opts?.isPartial;
    const errored = Boolean(context?.isError || result?.isError);
    const args = context?.args ?? {};
    const title = args.title ?? "";
    const call = buildCallLine(
      theme,
      "Memory create",
      args.parent_uri ?? "",
      title ? ` → ${title}` : undefined,
    );

    if (isPartial) return renderResultPending(call, theme, "creating");
    if (errored) return renderResultError(call, theme, result, "create failed");

    const nodeContent = typeof args.content === "string" ? args.content : "";
    const allLines = nodeContent.split(/\r?\n/);
    const count = allLines.length;
    let text = `${call}${theme.fg("dim", " · ")}${theme.fg("success", "created")}`;

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
      if (count > 1) text += theme.fg("dim", ` · ${count - 1} more · ctrl+o to expand`);
    }
    return lines(text);
  },
});
