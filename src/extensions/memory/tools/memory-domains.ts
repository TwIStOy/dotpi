import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runHat } from "../cli-runner.js";
import { jsonError, jsonResult } from "../tool-result.js";

export const memoryDomains = defineTool({
  name: "memory-domains",
  label: "Memory domains",
  description: "List all memory domains with their node counts.",
  parameters: Type.Object({}),
  execute: async () => {
    try {
      const result = await runHat(["memory", "domains"]);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
});
