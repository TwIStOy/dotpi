import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runHat } from "../cli-runner.js";
import { jsonError, jsonResult } from "../tool-result.js";

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
});
