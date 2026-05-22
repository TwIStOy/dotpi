import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runHat } from "../cli-runner.js";
import { jsonError, jsonResult } from "../tool-result.js";

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
});
