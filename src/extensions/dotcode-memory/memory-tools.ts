import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runDotcode } from "./cli-runner.js";
import { jsonError, jsonResult } from "./tool-result.js";

export function registerMemoryTools(pi: ExtensionAPI): void {
  pi.registerTool(
    defineTool({
      name: "memory-read",
      label: "Memory read",
      description:
        "Read a memory node by URI. Supports regular URIs (e.g. 'core://agent/identity') and system URIs (e.g. 'system://boot', 'system://index', 'system://glossary').",
      parameters: Type.Object({
        uri: Type.String({
          description:
            "Memory URI (e.g. 'core://agent/identity') or system URI (e.g. 'system://boot').",
        }),
      }),
      execute: async (_id, args) => {
        try {
          const result = await runDotcode(["memory", "read", args.uri]);
          return jsonResult(result);
        } catch (e) {
          return jsonError(e);
        }
      },
    }),
  );

  pi.registerTool(
    defineTool({
      name: "memory-create",
      label: "Memory create",
      description:
        "Create a new child memory node under a parent URI. URI format: domain://path (e.g. 'core://agent').",
      parameters: Type.Object({
        parent_uri: Type.String({
          description:
            "Parent URI (e.g. 'core://agent'). Use 'core://' for domain root.",
        }),
        content: Type.String({
          description: "Memory content (supports Markdown).",
        }),
        priority: Type.Optional(
          Type.Number({
            description: "Priority: 0 (highest) to 9 (lowest). Default 5.",
          }),
        ),
        title: Type.Optional(
          Type.String({
            description:
              "Path segment name (a-z, 0-9, _, -). Auto-assigned if omitted.",
          }),
        ),
        disclosure: Type.Optional(
          Type.String({
            description: "When to recall: trigger condition for this memory.",
          }),
        ),
      }),
      execute: async (_id, args) => {
        try {
          const cliArgs = ["memory", "create", args.parent_uri, args.content];
          if (args.priority !== undefined)
            cliArgs.push("--priority", String(args.priority));
          if (args.title) cliArgs.push("--title", args.title);
          if (args.disclosure) cliArgs.push("--disclosure", args.disclosure);
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
      name: "memory-update",
      label: "Memory update",
      description:
        "Update a memory node's content (patch or append) and/or metadata. Patch mode (old_string/new_string) and append mode are mutually exclusive.",
      parameters: Type.Object({
        uri: Type.String({
          description:
            "Node URI in domain://path format (e.g. 'core://agent/identity').",
        }),
        old_string: Type.Optional(
          Type.String({
            description: "Text to find and replace (must match exactly once).",
          }),
        ),
        new_string: Type.Optional(
          Type.String({
            description:
              "Replacement text. Empty string to delete the matched text.",
          }),
        ),
        append: Type.Optional(
          Type.String({
            description:
              "Text to append to content (mutually exclusive with patch).",
          }),
        ),
        priority: Type.Optional(Type.Number({ description: "New priority." })),
        disclosure: Type.Optional(
          Type.String({ description: "New disclosure/trigger condition." }),
        ),
      }),
      execute: async (_id, args) => {
        try {
          const cliArgs = ["memory", "update", args.uri];
          if (args.old_string !== undefined)
            cliArgs.push("--old-string", args.old_string);
          if (args.new_string !== undefined)
            cliArgs.push("--new-string", args.new_string);
          if (args.append) cliArgs.push("--append", args.append);
          if (args.priority !== undefined)
            cliArgs.push("--priority", String(args.priority));
          if (args.disclosure !== undefined)
            cliArgs.push("--disclosure", args.disclosure);
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
          const result = await runDotcode(["memory", "delete", args.uri]);
          return jsonResult(result);
        } catch (e) {
          return jsonError(e);
        }
      },
    }),
  );

  pi.registerTool(
    defineTool({
      name: "memory-search",
      label: "Memory search",
      description:
        "Ranked search across all memory nodes. Tokenizes query, scores matches across URI, content, tags, and disclosure fields, returns results sorted by relevance with snippets.",
      parameters: Type.Object({
        query: Type.String({
          description: "Search keywords (tokenized, multi-term supported).",
        }),
        limit: Type.Optional(
          Type.Number({ description: "Max results (default 10)." }),
        ),
      }),
      execute: async (_id, args) => {
        try {
          const cliArgs = ["memory", "search", args.query];
          if (args.limit !== undefined)
            cliArgs.push("--limit", String(args.limit));
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
      name: "memory-alias",
      label: "Memory alias",
      description:
        "Create or remove an alias (virtual path) pointing to an existing node. Not a copy — same content, independent priority and disclosure.",
      parameters: Type.Object({
        new_uri: Type.Optional(
          Type.String({
            description:
              "The alias URI to create, in domain://path format (e.g. 'notes://shortcuts/my-alias').",
          }),
        ),
        target_uri: Type.Optional(
          Type.String({
            description:
              "The existing node URI to point to, in domain://path format (e.g. 'core://agent/identity').",
          }),
        ),
        remove_uri: Type.Optional(
          Type.String({
            description: "The alias URI to remove, in domain://path format.",
          }),
        ),
        priority: Type.Optional(
          Type.Number({
            description: "Independent priority for this alias.",
          }),
        ),
        disclosure: Type.Optional(
          Type.String({
            description: "Independent disclosure for this alias.",
          }),
        ),
      }),
      execute: async (_id, args) => {
        try {
          if (args.remove_uri) {
            const result = await runDotcode([
              "memory",
              "alias",
              "--remove-uri",
              args.remove_uri,
            ]);
            return jsonResult(result);
          }
          if (!args.new_uri || !args.target_uri) {
            return jsonResult({
              error:
                "Provide new_uri + target_uri to create, or remove_uri to delete.",
            });
          }
          const cliArgs = [
            "memory",
            "alias",
            "--new-uri",
            args.new_uri,
            "--target-uri",
            args.target_uri,
          ];
          if (args.priority !== undefined)
            cliArgs.push("--priority", String(args.priority));
          if (args.disclosure) cliArgs.push("--disclosure", args.disclosure);
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
      name: "memory-domains",
      label: "Memory domains",
      description: "List all memory domains with their node counts.",
      parameters: Type.Object({}),
      execute: async () => {
        try {
          const result = await runDotcode(["memory", "domains"]);
          return jsonResult(result);
        } catch (e) {
          return jsonError(e);
        }
      },
    }),
  );
}