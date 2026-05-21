---
name: pi-extension
description: Guide for changing or extending Pi behaviour and building Pi Coding Agent extensions. Use when modifying how Pi behaves, choosing among Agent Skills vs extensions vs prompts/themes/packages, scaffolding or packaging an extension, creating custom tools/commands/hooks/providers/UI, intercepting tool calls, debugging extensions, or deciding whether a core Pi patch is needed. Also use for TypeScript extension work (ExtensionAPI, pi.registerTool, pi.on).
---

# Pi extension & behaviour changes

Help choose the right artifact, then implement. This skill is **not** a full API reference — Pi docs, `examples/extensions/`, and installed types under `@earendil-works/pi-coding-agent` (or `@mariozechner/pi-coding-agent`) are authoritative for signatures and current behaviour.

**In this repo:** the shipped extension entry is `package.json` → `pi.extensions` → `./src/index.ts`; skills live under `./skills` via `pi.skills`.

## Core principle: public extension points first, patch last

Prefer Agent Skills, context files, prompt templates, themes, `models.json`, provider extensions, settings, and TypeScript extensions before changing Pi internals. A core patch is rare and needs evidence that no public surface can express the behaviour.

## Choosing what to build

| Goal | Build a… | Typical locations | Source of truth |
|------|----------|-------------------|-----------------|
| Teach workflow, domain, or how to use a tool/API/CLI | **Agent Skill** | `SKILL.md` + optional `scripts/`, `references/`, `assets/` in `.agents/skills/`, `.pi/skills/`, or package `pi.skills` | Agent Skills standard; Pi `docs/skills.md`; upstream `skill-creator` skill when authoring |
| Change runtime: typed tool, command, hook, UI, safety gate, session/compaction, resource loader | **Extension** (this skill, below) | `.pi/extensions/`, `~/.pi/agent/extensions/`, or package `pi.extensions` | Read **`docs/extensions.md` end-to-end** + matching `examples/extensions/` |
| Reusable prompt with variables | **Prompt template** | `.pi/prompts/`, `~/.pi/agent/prompts/`, package | `docs/prompt-templates.md` |
| Project/user instructions | **Context file** | `AGENTS.md`, `CLAUDE.md`, `SYSTEM.md`, `APPEND_SYSTEM.md` | Pi README context / system prompt sections |
| Appearance | **Theme** | `.pi/themes/`, package | `docs/themes.md` |
| Models/providers | **models.json** or **provider extension** | `~/.pi/agent/models.json` vs extension for OAuth/discovery/custom streaming | `docs/models.md`, `docs/custom-provider.md` |
| Share any of the above | **Pi package** | `package.json` `"pi": { extensions, skills, … }` or conventional dirs | `docs/packages.md` |

Use **Agent Skill** / **Agent Skills** for the instruction artifact (not client-specific names like “Pi skill file” unless discussing discovery paths).

## Agent Skill vs extension

| Need | Prefer |
|------|--------|
| “Know our deploy process” / conventions / how to run a CLI | **Agent Skill** |
| Confirm before `rm -rf`, change footer, plan mode, subagents, compaction | **Extension** |
| Brave Search via script + instructions | **Skill** if enough; **Extension** if typed tool, custom UI, or tight runtime integration |
| Structured `db_query` tool the model must call | **Extension** |

**This document’s deep sections apply when the answer is Extension (or you are working in this repo’s `src/` extension code).**

## Behavior-change triage

1. State the desired **user-visible** behaviour in one sentence.
2. Pick the **lightest** row from the table above.
3. Read the **current** doc for that surface (do not guess APIs from memory).
4. **Copy a working example** from `node_modules/@earendil-works/pi-coding-agent/examples/extensions/` (or upstream equivalent) when one exists.
5. Only then implement; if you believe a **core patch** is required, complete the patch policy below first.

## Extension workflow (before writing code)

Agents often miss hooks by skimming one section of `extensions.md`. Do the full audit:

1. Read **`docs/extensions.md` fully** (hooks, tools, commands, keybindings, resource loaders, renderers, session/compaction, settings, linked docs).
2. Follow linked docs for your surface: `docs/tui.md`, `docs/themes.md`, `docs/models.md`, `docs/custom-provider.md`, `docs/packages.md`, `docs/keybindings.md`, `docs/session-format.md`, `docs/compaction.md`, `docs/sdk.md` as needed.
3. Read **`examples/extensions/README.md`** and at least one matching example; match current structure.
4. Map the request to a capability: events, tools, commands, shortcuts, flags, UI, rendering, resources, providers, compaction/session hooks, packaging.
5. If docs/examples are ambiguous, inspect **`dist/core/extensions/types.d.ts`** (or `src/` in the package) — do not invent signatures.
6. Build as extension/package unless you have **concrete** proof no public point exists; then patch policy.

## Patch policy

Patches are for core bugs, missing primitives that cannot be user-extended, or behaviour with no public route. Before patching upstream Pi:

1. Read `CONTRIBUTING.md` and `AGENTS.md` in **earendil-works/pi** (or the fork you target).
2. Document desired behaviour, every public option considered, what you read, and why each failed.
3. Prefer the smallest **public API addition** when the behaviour should stay user-extensible.
4. Do not open a PR you cannot explain (code path, edge cases, tests).

## Quick-start validation

| Artifact | How to verify |
|----------|----------------|
| Agent Skill | `pi --no-skills --skill /path/to/skill` or `/skill:name`; fix `name` / `description` frontmatter if it does not trigger |
| Extension | `pi -e ./path/to/extension.ts`; for iteration use `.pi/extensions/` or `~/.pi/agent/extensions/` and **`/reload`** |
| This package | `pi install .` / link per `docs/packages.md`; run agent with extension enabled |
| Themes / prompts / models | Per linked doc; `/reload` or restart when required |

When sharing: `package.json` `pi` manifest (see **dotpi** `package.json`) and test install from path or git/npm.

---

# Pi Extension Development

Build extensions for the Pi Coding Agent — TypeScript modules loaded via jiti (no compilation needed for ad-hoc extensions; this repo uses `tsc` for its own build).

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

## Package Namespaces

The canonical packages are `@mariozechner/pi-coding-agent`, `@mariozechner/pi-ai`, and `@mariozechner/pi-tui`.
A compatible fork exists at `@earendil-works/pi-coding-agent`, `@earendil-works/pi-ai`, `@earendil-works/pi-tui` — same APIs, different namespace. **This repo uses `@earendil-works/*`.** Remap imports when porting extensions between them.

## Key APIs

### Events (`pi.on`)

See [references/events.md](references/events.md) for the full event catalog.

### ExtensionAPI Methods

| Method | Purpose |
|---|---|
| `pi.on(event, handler)` | Subscribe to events |
| `pi.registerTool(def)` | Register LLM-callable tool (accepts `defineTool()` wrapper for typed rendering) |
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

### Port OpenCode slash commands (template → user turn)

OpenCode plugins register `config.command` entries with a `template` string and `$ARGUMENTS`. In Pi, mirror that with a template module and `pi.sendUserMessage`:

```typescript
// commands/my-command-template.ts
export const MY_TEMPLATE = `Do the workflow...\n\n"$ARGUMENTS" — optional scope.`;
export function buildMyPrompt(args: string): string {
  const line = args.trim() || "none — full scope";
  return MY_TEMPLATE.replace("$ARGUMENTS", line);
}

// index.ts
pi.registerCommand("my-command", {
  description: "...",
  handler: async (args, ctx) => {
    if (!ctx.isIdle()) {
      ctx.ui.notify("Agent is busy.", "warning");
      return;
    }
    pi.sendUserMessage(buildMyPrompt(args));
  },
});
```

Reference implementation: `src/extensions/dotcode-memory/commands/` (`self-improve-template.ts`, `reorganize-memory-template.ts`). Register long-running workflow commands **before** any early-return that disables the rest of the extension if the command should still exist when tools are off (e.g. `/memory-status`).

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

### AgentSession API (subagent pattern)

Create isolated agent sessions that run independently — used for subagent systems, background tasks, and parallel execution.

```typescript
import {
  createAgentSession,
  DefaultResourceLoader,
  SessionManager,
  SettingsManager,
  getAgentDir,
  parseFrontmatter,
} from "@mariozechner/pi-coding-agent";

const agentDir = getAgentDir();
const loader = new DefaultResourceLoader({
  cwd: ctx.cwd,
  agentDir,
  noExtensions: false,
  noSkills: false,
  noPromptTemplates: true,
  noThemes: true,
  noContextFiles: true,
  systemPromptOverride: () => "Custom system prompt",
  appendSystemPromptOverride: () => [],
});
await loader.reload();

const { session } = await createAgentSession({
  cwd: ctx.cwd,
  agentDir,
  sessionManager: SessionManager.inMemory(ctx.cwd),
  settingsManager: SettingsManager.create(ctx.cwd, agentDir),
  modelRegistry: ctx.modelRegistry,
  model: ctx.model,
  tools: ["read", "bash", "grep", "find", "ls"],
  resourceLoader: loader,
});

session.setSessionName("my-agent");
session.setActiveToolsByName(session.getActiveToolNames().filter(t => t !== "dangerous-tool"));
await session.bindExtensions({ onError: (err) => console.error(err) });

const unsub = session.subscribe((event) => {
  if (event.type === "turn_end") { /* turn completed */ }
  if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
    /* streaming text: event.assistantMessageEvent.delta */
  }
});

await session.prompt("Do the task");
unsub();
session.dispose();
```

**AgentSession methods:**

| Method | Purpose |
|---|---|
| `subscribe(handler)` → unsub | Listen to session events |
| `prompt(text)` | Send message and run to completion |
| `steer(message)` | Inject mid-run message (interrupts after current tool) |
| `abort()` | Hard stop |
| `setSessionName(name)` | Set display name |
| `getActiveToolNames()` → `string[]` | List available tools |
| `setActiveToolsByName(names)` | Filter available tools |
| `bindExtensions(opts?)` | Initialize extensions in session |
| `messages` | Conversation history array |
| `getSessionStats()` → `{ tokens, contextUsage }` | Token usage and context info |
| `dispose()` | Clean up session |

**Utility exports:**

| Export | Purpose |
|---|---|
| `getAgentDir()` | Default agent directory path (`~/.pi/agent/`) |
| `parseFrontmatter<T>(content)` | Parse YAML frontmatter from markdown |
| `SessionManager.inMemory(cwd)` | Create in-memory session manager |
| `SettingsManager.create(cwd, agentDir)` | Create settings manager |

## Important Notes

- **`defineTool`**: Exported from `@mariozechner/pi-coding-agent`. Wraps a tool definition to add typed `renderCall`/`renderResult` support. Use: `pi.registerTool(defineTool({ ... }))`.
- **`renderResult` must return `Component`**: Cannot return `undefined`. Use `new Text("", 0, 0)` as empty fallback. The `result.details` field carries UI-specific data separate from `result.content` (which the LLM sees).
- **Two rendering pipelines**: Tool `renderResult` handles tool call/result TUI display. `registerMessageRenderer` handles `CustomMessage` entries (via `pi.sendMessage`). These are separate — tool results are NOT custom messages.
- **`PackageSource`**: Settings type for npm/git packages. `type PackageSource = string | { source, extensions?, skills?, prompts?, themes? }`. Access via `ctx.settingsManager.getPackages()`.
- **`resources_discover` event**: Extensions can return `{ skillPaths, promptPaths, themePaths }` to advertise additional resource directories.
- **Security**: Extensions run with full system permissions. Only install from trusted sources.
- **TypeScript via jiti**: No compilation step needed for loose extensions; **dotpi** still runs `npm run build` for CI.
- **Output truncation**: Tools MUST truncate output. Use `truncateHead`/`truncateTail` from `@mariozechner/pi-coding-agent`. Default limits: 50KB, 2000 lines.
- **String enums**: Use `StringEnum` from `@mariozechner/pi-ai`, NOT `Type.Union`/`Type.Literal` (incompatible with Google API). Note: `@earendil-works/pi-ai` does NOT export `StringEnum` — use `Type.Union`/`Type.Literal` there instead. Import `Type` from `"typebox"` (or `"@sinclair/typebox"` for upstream).
- **ThinkingLevel**: Import from `@mariozechner/pi-agent-core` (or `@earendil-works/pi-agent-core`), NOT from pi-ai or pi-coding-agent. Type: `"off" | "minimal" | "low" | "medium" | "high" | "xhigh"`.
- **Error handling**: Tool `execute` errors must be thrown (not returned). Thrown errors are caught and reported with `isError: true`.
- **Check `ctx.hasUI`** before using UI methods in non-interactive modes (print/JSON).
- **File mutation queue**: Use `withFileMutationQueue` from `@mariozechner/pi-coding-agent` for parallel-safe file writes.
- **Hot reload**: Extensions in auto-discovered locations reload with `/reload`.
- **Testing**: `pi -e ./my-extension.ts` for quick testing.

## TUI Widgets — Avoiding Terminal Corruption

When building TUI widgets that display dynamic content (agent status, progress, etc.):

1. **Use `setWidget` factory pattern, NOT Component mode** for widgets with frequently-changing content. Component's `render()` is called every TUI render cycle — if it produces different content each time (e.g., `Date.now()` for elapsed time), it causes differential renderer corruption when other output wraps lines.

2. **Lazy UI context capture**: Get TUI context from `tool_execution_start` or similar late event, NOT `session_start`. TUI may not be fully initialized at session start.

3. **Register factory ONCE**: Use a `widgetRegistered` flag. Subsequent updates only call `tui?.requestRender()`.

4. **Controlled update cadence**: Drive updates with `setInterval` (e.g., 80ms). Auto-stop when no active content to display.

5. **Why Component mode corrupts**: The TUI tracks `previousLines` for differential rendering. If widget `render()` changes content while agent output simultaneously changes line count (wrapping), line count mismatches cause cursor positioning errors → duplicated headings, phantom lines, doubled agents.

## References

- [events.md](references/events.md) — Full event catalog and lifecycle flow
- [tools.md](references/tools.md) — Tool definition, rendering, stateful patterns, truncation
- [context.md](references/context.md) — Context properties, UI methods, providers
- Installed package: `node_modules/@earendil-works/pi-coding-agent/docs/extensions.md` and `examples/extensions/`
- Upstream routing skill (artifact choice): [tmustier/pi-extensions `extending-pi/SKILL.md`](https://github.com/tmustier/pi-extensions/blob/main/extending-pi/SKILL.md)