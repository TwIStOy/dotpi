import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runHat } from "../cli-runner.js";
import { jsonError, jsonResult } from "../tool-result.js";

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
});
