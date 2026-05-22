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

export const memoryDelete = defineTool({
  name: "memory-delete",
  label: "Memory delete",
  description:
    "Delete a memory node. Removes the file but does not remove aliases pointing to it.",
  parameters: Type.Object({
    uri: Type.String({
      description:
        "Node URI in domain://path format (e.g. 'core://agent/identity').",
    }),
  }),
  execute: async (_id, args) => {
    try {
      const result = await runHat(["memory", "delete", args.uri]);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
  renderCall(args: any, theme: any, context: any) {
    return renderCall(theme, context, "Memory delete", args?.uri ?? "");
  },
  renderResult(result: any, opts: any, theme: any, context: any) {
    const isPartial = opts?.isPartial;
    const errored = Boolean(context?.isError || result?.isError);
    const uri = context?.args?.uri ?? "";
    const call = buildCallLine(theme, "Memory delete", uri);

    if (isPartial) return renderResultPending(call, theme, "deleting");
    if (errored) return renderResultError(call, theme, result, "delete failed");

    return lines(`${call}${theme.fg("dim", " · ")}${theme.fg("success", "deleted")}`);
  },
});
