---
name: pi-extension
description: Create, edit, and debug Pi Coding Agent extensions (TypeScript modules that extend Pi's behavior with custom tools, event handlers, commands, providers, and UI components). Use when the user asks to build a Pi extension, write an extension for Pi agent, register custom tools or commands for Pi, intercept Pi tool calls, or mentions Pi extensions, pi.registerTool, pi.registerCommand, pi.on, ExtensionAPI.
---

# Pi Extension Development

Build extensions for the Pi Coding Agent — TypeScript modules loaded via jiti (no compilation needed).

## Extension Structure

Three structural styles, placed in auto-discovery locations or configured in `settings.json`:

**Single file:**
```
~/.pi/agent/extensions/my-extension.ts
```

**Directory with index.ts:**
```
~/.pi/agent/extensions/my-extension/
├── index.ts        # Entry point (exports default function)
└── utils.ts
```

**Package with npm deps:**
```
~/.pi/agent/extensions/my-extension/
├── package.json    # "pi": { "extensions": ["./src/index.ts"] }
├── node_modules/
└── src/index.ts
```

**Auto-discovery locations:**

| Location | Scope |
|---|---|
| `~/.pi/agent/extensions/*.ts` | Global |
| `~/.pi/agent/extensions/*/index.ts` | Global |
| `.pi/extensions/*.ts` | Project-local |
| `.pi/extensions/*/index.ts` | Project-local |

Additional paths in `settings.json`: `"extensions": ["/path/to/file.ts"]` and `"packages": ["npm:@scope/pkg@1.0.0"]`.

## Minimal Extension

```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Extension loaded!", "info");
  });

  pi.registerTool({
    name: "greet",
    label: "Greet",
    description: "Greet someone by name",
    parameters: Type.Object({
      name: Type.String({ description: "Name to greet" }),
    }),
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return {
        content: [{ type: "text", text: `Hello, ${params.name}!` }],
        details: {},
      };
    },
  });
}
```

Async factory for startup work:
```typescript
export default async function (pi: ExtensionAPI) {
  const resp = await fetch("http://localhost:1234/v1/models");
  const payload = await resp.json();
  // ... use payload to register provider etc.
}
```

## Key APIs

### Events (`pi.on`)

See [references/events.md](references/events.md) for the full event catalog.

### ExtensionAPI Methods

| Method | Purpose |
|---|---|
| `pi.on(event, handler)` | Subscribe to events |
| `pi.registerTool(def)` | Register LLM-callable tool |
| `pi.registerCommand(name, opts)` | Register slash command (`/name`) |
| `pi.registerProvider(name, config)` | Register/override model provider |
| `pi.registerMessageRenderer(type, fn)` | Custom message TUI renderer |
| `pi.registerShortcut(key, opts)` | Register keyboard shortcut |
| `pi.registerFlag(name, opts)` | Register CLI flag |
| `pi.sendMessage(msg, opts?)` | Inject message into session |
| `pi.sendUserMessage(text, opts?)` | Send user message (triggers turn) |
| `pi.appendEntry(type, data?)` | Persist extension state across sessions |
| `pi.exec(cmd, args, opts?)` | Execute shell command |
| `pi.events` | Shared event bus for inter-extension comms |

### Tool Registration

See [references/tools.md](references/tools.md) for full tool definition schema, stateful patterns, rendering, and output truncation.

### Context (`ctx`)

See [references/context.md](references/context.md) for ctx properties, UI methods, and command context extensions.

## Common Patterns

### Block dangerous tool calls
```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "bash" && event.input.command?.includes("rm -rf")) {
    const ok = await ctx.ui.confirm("Dangerous!", "Allow rm -rf?");
    if (!ok) return { block: true, reason: "Blocked by user" };
  }
});
```

### Modify tool input
```typescript
pi.on("tool_call", async (event, ctx) => {
  if (event.toolName === "bash") {
    event.input.command = `source ~/.profile\n${event.input.command}`;
  }
});
```

### Modify tool result
```typescript
pi.on("tool_result", async (event, ctx) => {
  return { content: event.content, details: { ...event.details, enriched: true } };
});
```

### Register slash command
```typescript
pi.registerCommand("hello", {
  description: "Say hello",
  handler: async (args, ctx) => {
    ctx.ui.notify(`Hello ${args || "world"}!`, "info");
  },
});
```

### Input interception
```typescript
pi.on("input", async (event, ctx) => {
  if (event.text === "ping") {
    ctx.ui.notify("pong", "info");
    return { action: "handled" };
  }
  return { action: "continue" };
});
```

### System prompt modification
```typescript
pi.on("before_agent_start", async (event, ctx) => {
  return {
    systemPrompt: event.systemPrompt + "\n\nExtra instructions...",
  };
});
```

### Override built-in tools
Register a tool with the same name (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`) to override. Use `--no-builtin-tools` to start without built-in tools.

## Important Notes

- **Security**: Extensions run with full system permissions. Only install from trusted sources.
- **TypeScript via jiti**: No compilation step needed.
- **Output truncation**: Tools MUST truncate output. Use `truncateHead`/`truncateTail` from `@mariozechner/pi-coding-agent`. Default limits: 50KB, 2000 lines.
- **String enums**: Use `StringEnum` from `@mariozechner/pi-ai`, NOT `Type.Union`/`Type.Literal` (incompatible with Google API).
- **Error handling**: Tool `execute` errors must be thrown (not returned). Thrown errors are caught and reported with `isError: true`.
- **Check `ctx.hasUI`** before using UI methods in non-interactive modes (print/JSON).
- **File mutation queue**: Use `withFileMutationQueue` from `@mariozechner/pi-coding-agent` for parallel-safe file writes.
- **Hot reload**: Extensions in auto-discovered locations reload with `/reload`.
- **Testing**: `pi -e ./my-extension.ts` for quick testing.

## References

- [events.md](references/events.md) — Full event catalog and lifecycle flow
- [tools.md](references/tools.md) — Tool definition, rendering, stateful patterns, truncation
- [context.md](references/context.md) — Context properties, UI methods, providers
