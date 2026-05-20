import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runDotcode } from "./cli-runner.js";
import { jsonError, jsonResult } from "./tool-result.js";

export function registerJournalTools(
  pi: ExtensionAPI,
  getCwd: () => string,
): void {
  pi.registerTool(
    defineTool({
      name: "journal-write",
      label: "Journal write",
      description:
        "Write a new journal entry (append-only). Journal entries are permanent records of discoveries, decisions, and insights.",
      parameters: Type.Object({
        title: Type.String({
          description: "Short title summarizing the entry.",
        }),
        body: Type.String({
          description: "Full content of the journal entry.",
        }),
        tags: Type.Optional(
          Type.Array(Type.String(), {
            description:
              'Tags for categorization (e.g., ["debugging", "networking"]).',
          }),
        ),
      }),
      execute: async (_id, args) => {
        try {
          const cliArgs = [
            "journal",
            "write",
            "--title",
            args.title,
            "--body",
            args.body,
            "--project",
            getCwd(),
          ];
          if (args.tags?.length) cliArgs.push("--tags", args.tags.join(","));
          const result = await runDotcode(cliArgs);
          return jsonResult(result);
        } catch (e) {
          return jsonError(e);
        }
      },
    }),
  );

  pi.registerTool(
    defineTool({
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
          const result = await runDotcode(["journal", "read", args.id]);
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
    }),
  );

  pi.registerTool(
    defineTool({
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
          const result = await runDotcode(cliArgs);
          return jsonResult(result);
        } catch (e) {
          return jsonError(e);
        }
      },
    }),
  );
}