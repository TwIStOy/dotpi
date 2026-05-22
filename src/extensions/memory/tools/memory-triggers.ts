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

export const memoryTriggers = defineTool({
  name: "memory-triggers",
  label: "Memory triggers",
  description:
    "Manage glossary trigger keywords for a node. When a keyword appears in any memory's content, the system auto-links to the target node.",
  parameters: Type.Object({
    uri: Type.String({
      description:
        "Target node URI in domain://path format (e.g. 'core://agent/identity').",
    }),
    add: Type.Optional(
      Type.Array(Type.String(), {
        description: "Keywords to bind to this node.",
      }),
    ),
    remove: Type.Optional(
      Type.Array(Type.String(), {
        description: "Keywords to unbind from this node.",
      }),
    ),
  }),
  execute: async (_id, args) => {
    try {
      const cliArgs = ["memory", "triggers", args.uri];
      if (args.add?.length) cliArgs.push("--add", args.add.join(","));
      if (args.remove?.length)
        cliArgs.push("--remove", args.remove.join(","));
      const result = await runHat(cliArgs);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
  renderCall(args: any, theme: any, context: any) {
    const uri = args?.uri ?? "";
    const parts: string[] = [];
    if (args?.add?.length) parts.push(`+${args.add.length}`);
    if (args?.remove?.length) parts.push(`-${args.remove.length}`);
    const suffix = parts.length > 0 ? ` ${parts.join(" ")}` : "";
    return renderCall(theme, context, "Memory triggers", uri, suffix || undefined);
  },
  renderResult(result: any, opts: any, theme: any, context: any) {
    const isPartial = opts?.isPartial;
    const errored = Boolean(context?.isError || result?.isError);
    const args = context?.args ?? {};
    const uri = args.uri ?? "";
    const call = buildCallLine(theme, "Memory triggers", uri);

    if (isPartial) return renderResultPending(call, theme, "updating triggers");
    if (errored) return renderResultError(call, theme, result, "triggers failed");

    const parts: string[] = [];
    if (args.add?.length) parts.push(`+${args.add.length} keyword${args.add.length === 1 ? "" : "s"}`);
    if (args.remove?.length) parts.push(`-${args.remove.length} keyword${args.remove.length === 1 ? "" : "s"}`);
    const detail = parts.length > 0 ? parts.join(", ") : "updated";
    return lines(`${call}${theme.fg("dim", " · ")}${theme.fg("success", detail)}`);
  },
});
