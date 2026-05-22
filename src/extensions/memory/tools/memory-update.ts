import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runHat } from "../cli-runner.js";
import { jsonError, jsonResult } from "../tool-result.js";
import {
  buildStructuredDiff,
  diffSummary,
  renderStructuredDiff,
  type StructuredDiff,
} from "../../tool-renderer/diff.js";
import {
  buildCallLine,
  lines,
  renderCall,
  renderResultError,
  renderResultPending,
} from "./render.js";

export const memoryUpdate = defineTool({
  name: "memory-update",
  label: "Memory update",
  description:
    "Update a memory node's content (patch or append) and/or metadata. Patch mode (old_string/new_string) and append mode are mutually exclusive.",
  parameters: Type.Object({
    uri: Type.String({
      description:
        "Node URI in domain://path format (e.g. 'core://agent/identity').",
    }),
    old_string: Type.Optional(
      Type.String({
        description: "Text to find and replace (must match exactly once).",
      }),
    ),
    new_string: Type.Optional(
      Type.String({
        description:
          "Replacement text. Empty string to delete the matched text.",
      }),
    ),
    append: Type.Optional(
      Type.String({
        description:
          "Text to append to content (mutually exclusive with patch).",
      }),
    ),
    priority: Type.Optional(Type.Number({ description: "New priority." })),
    disclosure: Type.Optional(
      Type.String({ description: "New disclosure/trigger condition." }),
    ),
  }),
  execute: async (_id, args) => {
    try {
      const cliArgs = ["memory", "update", args.uri];
      if (args.old_string !== undefined)
        cliArgs.push("--old-string", args.old_string);
      if (args.new_string !== undefined)
        cliArgs.push("--new-string", args.new_string);
      if (args.append) cliArgs.push("--append", args.append);
      if (args.priority !== undefined)
        cliArgs.push("--priority", String(args.priority));
      if (args.disclosure !== undefined)
        cliArgs.push("--disclosure", args.disclosure);
      const result = await runHat(cliArgs);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
  renderCall(args: any, theme: any, context: any) {
    return renderCall(theme, context, "Memory update", args?.uri ?? "");
  },
  renderResult(result: any, opts: any, theme: any, context: any) {
    const expanded = opts?.expanded;
    const isPartial = opts?.isPartial;
    const errored = Boolean(context?.isError || result?.isError);
    const args = context?.args ?? {};
    const call = buildCallLine(theme, "Memory update", args.uri ?? "");

    if (isPartial) return renderResultPending(call, theme, "updating");
    if (errored) return renderResultError(call, theme, result, "update failed");

    let diff: StructuredDiff | undefined;
    if (args.old_string !== undefined) {
      const oldText = String(args.old_string);
      const newText = args.new_string !== undefined ? String(args.new_string) : "";
      diff = buildStructuredDiff(oldText, newText);
    } else if (args.append !== undefined) {
      diff = buildStructuredDiff("", String(args.append));
    }

    if (!diff || (diff.additions === 0 && diff.removals === 0)) {
      const meta: string[] = [];
      if (args.priority !== undefined) meta.push(`p${args.priority}`);
      if (args.disclosure !== undefined) meta.push("disclosure");
      const detail = meta.length > 0 ? ` · ${meta.join(", ")}` : "";
      return lines(`${call}${theme.fg("dim", " · ")}${theme.fg("success", "updated")}${theme.fg("dim", detail)}`);
    }

    let text = `${call}${theme.fg("dim", " · ")}${diffSummary(diff, theme)}`;

    if (expanded) {
      text += `\n${renderStructuredDiff(diff, theme, true, undefined, undefined, undefined, 2)}`;
    } else {
      text += theme.fg("dim", " · ctrl+o to expand");
    }
    return lines(text);
  },
});
