import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runHat } from "../cli-runner.js";
import { jsonError, jsonResult } from "../tool-result.js";

export const journalSearch = defineTool({
  name: "journal-search",
  label: "Journal search",
  description:
    "Search journal entries by text content or tags with pagination. Returns summaries sorted by recency.",
  parameters: Type.Object({
    text: Type.Optional(
      Type.String({
        description: "Substring to search for in title and body.",
      }),
    ),
    tags: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Filter by tags (entries matching ANY tag are included).",
      }),
    ),
    limit: Type.Optional(
      Type.Number({
        description: "Maximum entries to return (default: 20).",
      }),
    ),
    offset: Type.Optional(
      Type.Number({
        description: "Number of entries to skip for pagination (default: 0).",
      }),
    ),
  }),
  execute: async (_id, args) => {
    try {
      const cliArgs = ["journal", "search"];
      if (args.text) cliArgs.push("--text", args.text);
      if (args.tags?.length) cliArgs.push("--tags", args.tags.join(","));
      if (args.limit !== undefined)
        cliArgs.push("--limit", String(args.limit));
      if (args.offset !== undefined)
        cliArgs.push("--offset", String(args.offset));
      const result = await runHat(cliArgs);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
});
