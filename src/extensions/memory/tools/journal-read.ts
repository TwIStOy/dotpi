import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runHat } from "../cli-runner.js";
import { jsonError, jsonResult } from "../tool-result.js";

export const journalRead = defineTool({
  name: "journal-read",
  label: "Journal read",
  description: "Read a specific journal entry by its timestamp ID.",
  parameters: Type.Object({
    id: Type.String({
      description:
        'Timestamp ID of the entry (e.g., "20260310-143025-001").',
    }),
  }),
  execute: async (_id, args) => {
    try {
      const result = await runHat(["journal", "read", args.id]);
      if (!result) {
        return jsonResult({
          error: `Journal entry "${args.id}" not found.`,
        });
      }
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
});
