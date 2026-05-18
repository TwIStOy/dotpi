# Extension Context & Providers

## ExtensionContext (`ctx`)

| Property | Type | Purpose |
|---|---|---|
| `ctx.ui` | object | UI methods (select, confirm, input, notify, custom) |
| `ctx.hasUI` | boolean | `false` in print/JSON mode, `true` in interactive/RPC |
| `ctx.cwd` | string | Current working directory |
| `ctx.sessionManager` | object | Read-only session state access |
| `ctx.modelRegistry` | object | Model registry access |
| `ctx.model` | object | Current model and API key access |
| `ctx.signal` | AbortSignal \| undefined | Agent abort signal for cancellation |
| `ctx.isIdle()` | function | Check if agent is streaming |
| `ctx.abort()` | function | Abort current agent turn |
| `ctx.hasPendingMessages()` | function | Check for queued messages |
| `ctx.shutdown()` | function | Request graceful shutdown |
| `ctx.getContextUsage()` | function | Current context token usage |
| `ctx.compact()` | function | Trigger compaction |
| `ctx.getSystemPrompt()` | function | Get current system prompt string |

## UI Methods (`ctx.ui`)

| Method | Signature | Purpose |
|---|---|---|
| `notify` | `(message, level: "info"\|"warn"\|"error") => void` | Show notification |
| `confirm` | `(title, message) => Promise<boolean>` | Yes/no confirmation |
| `select` | `(title, options, multi?) => Promise<string[]>` | Selection dialog |
| `input` | `(message, default?) => Promise<string>` | Text input dialog |
| `custom` | `(factory) => Promise<T>` | Full custom TUI component |
| `setEditorComponent` | `(factory) => void` | Replace input editor |

### Custom UI Component

```typescript
const result = await ctx.ui.custom<boolean>((tui, theme, keybindings, done) => {
  const text = new Text("Press Enter to confirm, Escape to cancel", 1, 1);
  text.onKey = (key) => {
    if (key === "return") done(true);
    if (key === "escape") done(false);
    return true;
  };
  return text;
});
```

### Custom Editor

```typescript
import { CustomEditor } from "@mariozechner/pi-coding-agent";
import { matchesKey } from "@mariozechner/pi-tui";

class VimEditor extends CustomEditor {
  private mode: "normal" | "insert" = "insert";
  handleInput(data: string): void {
    if (matchesKey(data, "escape") && this.mode === "insert") {
      this.mode = "normal";
      return;
    }
    if (this.mode === "normal" && data === "i") {
      this.mode = "insert";
      return;
    }
    super.handleInput(data);
  }
}

pi.on("session_start", (_event, ctx) => {
  ctx.ui.setEditorComponent((_tui, theme, keybindings) =>
    new VimEditor(theme, keybindings)
  );
});
```

## ExtensionCommandContext (extends ExtensionContext)

Only available in command handlers:

| Method | Purpose |
|---|---|
| `ctx.waitForIdle()` | Wait for agent to finish streaming |
| `ctx.newSession(options?)` | Create new session with optional setup |
| `ctx.fork(entryId, options?)` | Fork from specific entry |
| `ctx.navigateTree(targetId, options?)` | Navigate session tree |
| `ctx.switchSession(sessionPath, options?)` | Switch to different session |
| `ctx.reload()` | Reload extensions/skills/prompts/themes |

## Provider Registration

```typescript
pi.registerProvider("my-provider", {
  baseUrl: "https://api.example.com/v1",
  apiKey: "MY_API_KEY",
  api: "openai-completions",  // or "openai-responses"
  models: [
    {
      id: "model-id",
      name: "Display Name",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 128000,
      maxTokens: 4096,
    },
  ],
});
```

### Provider with OAuth

```typescript
pi.registerProvider("corporate-ai", {
  baseUrl: "https://ai.corp.com",
  api: "openai-responses",
  models: [...],
  oauth: {
    name: "Corporate AI (SSO)",
    async login(callbacks) {
      callbacks.onAuth({ url: "https://sso.corp.com/..." });
      const code = await callbacks.onPrompt({ message: "Enter code:" });
      return { refresh: code, access: code, expires: Date.now() + 3600000 };
    },
    async refreshToken(credentials) { return credentials; },
    getApiKey(credentials) { return credentials.access; },
  },
});
```

## Mode Behavior

| Mode | UI Available | Notes |
|---|---|---|
| Interactive | Full TUI | Normal operation |
| RPC (`--mode rpc`) | JSON protocol | Host handles UI |
| JSON (`--mode json`) | No-op | Event stream to stdout |
| Print (`-p`) | No-op | Extensions run but can't prompt |

Always check `ctx.hasUI` before using UI methods.

## Signal Usage

```typescript
// ctx.signal is defined during active turns, undefined when idle
async execute(toolCallId, params, signal, onUpdate, ctx) {
  const resp = await fetch(url, { signal: ctx.signal });
  // ...
}

// In idle contexts (session events, commands, shortcuts), ctx.signal is usually undefined
```

## pi-tui Utilities

Import from `@mariozechner/pi-tui` (or `@earendil-works/pi-tui`):

```typescript
import {
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
  matchesKey,
  Component,
  TUI,
} from "@mariozechner/pi-tui";
```

| Export | Purpose |
|---|---|
| `truncateToWidth(text, width)` | Truncate string to terminal column width (handles CJK/emoji) |
| `visibleWidth(text)` | Count visible terminal columns (ANSI-aware) |
| `wrapTextWithAnsi(text, width)` | Word-wrap text to width, preserving ANSI escape codes |
| `matchesKey(data, key)` | Match raw terminal input to key name ("escape", "up", "pageDown", "ctrl+c", etc.) |
| `Component` | Interface for custom overlay components: `handleInput(data)`, `render(width) → string[]`, `invalidate()`, `dispose()` |
| `TUI` | Terminal UI instance: `terminal.rows`, `terminal.columns`, `requestRender()` |

**Component interface:**
```typescript
class MyOverlay implements Component {
  handleInput(data: string): void { /* key handling */ }
  render(width: number): string[] { /* return lines to display */ }
  invalidate(): void { /* clear cached state */ }
  dispose(): void { /* cleanup */ }
}
```

## Session Replacement Footguns

- `withSession` runs after old session shutdown + teardown + new session rebind
- Old `pi`/`ctx` are **stale** after replacement and will throw if used
- Only use the `ctx` passed to the current callback
- Previously captured objects (e.g., `const sm = ctx.sessionManager`) are still old objects
