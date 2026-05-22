import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runHat } from "../cli-runner.js";
import { jsonError, jsonResult } from "../tool-result.js";

export const memoryHistory = defineTool({
  name: "memory-history",
  label: "Memory history",
  description:
    "View version history for a specific memory node. Returns snapshots of past content with timestamps and action types.",
  parameters: Type.Object({
    uri: Type.String({
      description:
        "Node URI in domain://path format (e.g. 'core://agent/identity').",
    }),
    limit: Type.Optional(
      Type.Number({ description: "Max entries to return (default 10)." }),
    ),
  }),
  execute: async (_id, args) => {
    try {
      const cliArgs = ["memory", "versions", args.uri];
      if (args.limit !== undefined)
        cliArgs.push("--limit", String(args.limit));
      const result = await runHat(cliArgs);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
});
