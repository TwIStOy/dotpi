import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runHat } from "../cli-runner.js";
import { jsonError, jsonResult } from "../tool-result.js";

export const journalWrite = (getCwd: () => string) =>
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
        const result = await runHat(cliArgs);
        return jsonResult(result);
      } catch (e) {
        return jsonError(e);
      }
    },
  });
