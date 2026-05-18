# Tool Registration

## Full Tool Definition

```typescript
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does (shown to LLM)",
  promptSnippet: "Short usage hint shown in system prompt",
  promptGuidelines: [
    "Use my_tool when the user asks to X. Each guideline must name the tool explicitly.",
  ],
  parameters: Type.Object({
    action: StringEnum(["list", "add"] as const),  // NOT Type.Union/Type.Literal
    text: Type.Optional(Type.String()),
  }),
  prepareArguments(args) {
    // Optional: transform args before schema validation
    return args;
  },
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    if (signal?.aborted) {
      return { content: [{ type: "text", text: "Cancelled" }] };
    }
    onUpdate?.({
      content: [{ type: "text", text: "Working..." }],
      details: { progress: 50 },
    });
    return {
      content: [{ type: "text", text: "Done" }],
      details: {},
      terminate: true,  // hint to skip follow-up LLM call
    };
  },
  renderCall(args, theme, context) { /* custom TUI */ },
  renderResult(result, options, theme, context) { /* custom TUI */ },
});
```

## Parameters Schema

Use `typebox` (`Type` from `"typebox"`) for schema definitions. Use `StringEnum` from `@mariozechner/pi-ai` for string enums — `Type.Union`/`Type.Literal` is incompatible with Google's API.

```typescript
import { Type } from "typebox";
import { StringEnum } from "@mariozechner/pi-ai";

parameters: Type.Object({
  path: Type.String({ description: "File path" }),
  mode: StringEnum(["read", "write"] as const),
  count: Type.Optional(Type.Number({ default: 10 })),
}),
```

## Output Truncation (REQUIRED)

Tools MUST truncate output. Built-in limit: **50KB** (~10k tokens), **2000 lines**.

```typescript
import {
  truncateHead, truncateTail,
  DEFAULT_MAX_BYTES, DEFAULT_MAX_LINES,
} from "@mariozechner/pi-coding-agent";

async execute(toolCallId, params, signal, onUpdate, ctx) {
  const output = await runCommand();
  const truncation = truncateHead(output, {
    maxLines: DEFAULT_MAX_LINES,
    maxBytes: DEFAULT_MAX_BYTES,
  });
  let result = truncation.content;
  if (truncation.truncated) {
    const tempFile = writeTempFile(output);
    result += `\n\n[Output truncated... Full output saved to: ${tempFile}]`;
  }
  return { content: [{ type: "text", text: result }] };
}
```

- `truncateHead` — for search results, file reads (keep end)
- `truncateTail` — for logs, command output (keep beginning)

## Error Handling

- Throw errors from `execute` (do NOT return error objects)
- Thrown errors are caught and reported to LLM with `isError: true`
- Returning a value never sets the error flag

## Stateful Tool with Persistence

```typescript
export default function (pi: ExtensionAPI) {
  let items: string[] = [];

  pi.on("session_start", async (_event, ctx) => {
    items = [];
    for (const entry of ctx.sessionManager.getBranch()) {
      if (entry.type === "message" && entry.message.role === "toolResult") {
        if (entry.message.toolName === "my_tool") {
          items = entry.message.details?.items ?? [];
        }
      }
    }
  });

  pi.registerTool({
    name: "my_tool",
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      items.push("new item");
      return {
        content: [{ type: "text", text: "Added" }],
        details: { items: [...items] },
      };
    },
  });
}
```

## File Mutation Queue (parallel-safe writes)

```typescript
import { withFileMutationQueue } from "@mariozechner/pi-coding-agent";

async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
  const absolutePath = resolve(ctx.cwd, params.path);
  return withFileMutationQueue(absolutePath, async () => {
    const current = await readFile(absolutePath, "utf8");
    const next = current.replace(params.oldText, params.newText);
    await writeFile(absolutePath, next, "utf8");
    return {
      content: [{ type: "text", text: `Updated ${params.path}` }],
      details: {},
    };
  });
}
```

## Multiple Tools Sharing State

```typescript
export default function (pi: ExtensionAPI) {
  let connection = null;
  pi.registerTool({ name: "db_connect", ... });
  pi.registerTool({ name: "db_query", ... });
  pi.registerTool({ name: "db_close", ... });
  pi.on("session_shutdown", async () => { connection?.close(); });
}
```

## Custom Rendering

```typescript
import { Text } from "@mariozechner/pi-tui";

pi.registerTool({
  name: "my_tool",
  renderShell: "self",  // render own shell instead of default Box
  renderCall(args, theme, context) {
    const text = (context.lastComponent as Text | undefined) ?? new Text("", 0, 0);
    let content = theme.fg("toolTitle", theme.bold("my_tool "));
    content += theme.fg("muted", args.action);
    text.setText(content);
    return text;
  },
  renderResult(result, { expanded, isPartial }, theme, context) {
    if (isPartial) return new Text(theme.fg("warning", "Processing..."), 0, 0);
    let text = theme.fg("success", "Done");
    if (expanded && result.details?.items) {
      for (const item of result.details.items) {
        text += "\n  " + theme.fg("dim", item);
      }
    }
    return new Text(text, 0, 0);
  },
});
```

Built-in renderer inheritance: if override omits `renderCall`/`renderResult`, the built-in version is used.

## Remote Execution (SSH pattern)

```typescript
import { createBashTool } from "@mariozechner/pi-coding-agent";

const bashTool = createBashTool(cwd, {
  spawnHook: ({ command, cwd, env }) => ({
    command: `source ~/.profile\n${command}`,
    cwd: `/mnt/sandbox${cwd}`,
    env: { ...env, CI: "1" },
  }),
});
```
