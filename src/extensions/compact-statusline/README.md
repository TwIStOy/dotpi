# Compact statusline (dotpi)

Single-line status: repo / model / thinking level / context remainder bar / right-hand percentage; optional subagent badge and Z.ai quota.

- **Left**: project name, branch badge (`🌳` linked worktree, `🦀` default trunk `main`/`master`, `🔀` other branches) and optional dirty `*`, model label, thinking level, context window size; when the current model is **Z.ai**, appends `zai <quota%>` and a truncated reset countdown (same data as `ZaiUsageCache` / `/zai-usage`).
- **Middle**: `─` bar sized by remaining context fraction.
- **Right**: remainder percentage; subagent name from parent env `PI_SUBAGENT_CHILD_AGENT` / `PI_SUBAGENT_CHILD_COLOR`, or the **bridge** below.

**Mechanics**: `ctx.ui.setWidget("dotpi-compact-statusline", …)`; whether the built-in footer is hidden is controlled by `REPLACE_BUILTIN_FOOTER` in **`settings.ts`**.

## Configuration

Edit the constants at the top of **`settings.ts`** (each field documents allowed values in its comment):

- `COMPACT_STATUSLINE_ENABLED` — load this extension or not
- `REPLACE_BUILTIN_FOOTER` — hide default footer via empty custom footer
- `SHOW_DIRTY_MARKER` — show `*` when the branch is dirty
- `GIT_REFRESH_TIMEOUT_MS` — git subprocess timeout in milliseconds

## Optional subagent bridge

Another extension may register:

`globalThis[Symbol.for("dotpi.compact-statusline.subagent-bridge")] = { getCurrentSubagent(cwd?) { return { name: string, color?: string }; } }`

This package exports: `import { SUBAGENT_STATUSLINE_BRIDGE_SYMBOL } from "./constants.js"` (adjust path to your layout).

## Files

| File                          | Role                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------- |
| `index.ts`                    | Event subscriptions, widget / footer                                                    |
| `statusline.ts`               | `renderStatusLine`, `refreshGitState`                                                   |
| `agent-statusline.ts`         | Subagent chip (`PI_SUBAGENT_*` + bridge)                                                |
| `bridges.ts` / `constants.ts` | `SubagentStatuslineBridge` and `Symbol.for("dotpi.compact-statusline.subagent-bridge")` |
| `settings.ts`                 | Static toggles and git timeout                                                          |
