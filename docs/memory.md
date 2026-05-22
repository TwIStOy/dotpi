# memory (dotpi extension)

The **memory** extension connects Pi Coding Agent sessions to the same graph memory and journal database used by the [hat](https://github.com/) desktop app. Agents read and write memories through the `hat` CLI; there is no separate in-process database in dotpi.

## Requirements

- **hat binary** on `PATH`, or:
  - **`HAT_CLI`** — absolute path to the `hat` executable, or
  - A local build under the hat repo (`tool/target/release/hat` or `result/bin/hat`) when developing monorepo-style layouts.

If the binary is missing, dotpi shows a **one-time warning per process** on the first `session_start` (when the extension is enabled).

## Enable / disable

| Mechanism | Effect |
|-----------|--------|
| Default | Extension **enabled** |
| Pi settings `memory.enabled: false` | No tools, no memory/journal system prompt appendix |
| `DOTPI_MEMORY=0` (or `false` / `off`) | Disabled for the whole process before any session |

Settings key (in project or user Pi settings, via `settingsManager.getProjectSettings()`):

```json
{
  "memory": {
    "enabled": true,
    "namespace": ""
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `true` | Register memory/journal tools and append prompts |
| `namespace` | `""` | Passed to hat as global `--namespace` (see below) |

Only alphanumeric characters, `_`, and `-` are allowed in `namespace`; invalid values are treated as empty (shared default store).

See `src/extensions/memory/settings.ts` for `MEMORY_SETTINGS_KEY` and `getNamespace()`.

### Namespace (multi-agent isolation)

hat supports a global CLI flag `--namespace <id>` so separate agents or sessions can use isolated memory/journal views without changing on-disk layout manually.

In dotpi, set per-project (or user) Pi settings:

```json
{
  "memory": {
    "enabled": true,
    "namespace": "routing-agent"
  }
}
```

Every tool invocation runs the CLI as:

`hat --json [--namespace <id>] memory …` / `journal …`

The active namespace is stored for the session on `session_start` and refreshed on `before_agent_start`. Use `/memory-status` to see the resolved namespace and domain list for that scope.

**Note:** Journal entries still include `--project` (cwd); namespace isolates hat's logical store, not the project path.

## Initialization order

dotpi loads extensions from `src/extensions/index.ts`. Relevant order:

1. **Subagents**, **tool-renderer**, **primary-agent** (Routing preset + dynamic appendix)
2. **memory** — registers tools on `session_start` when enabled; appends `<memory_instructions>` / `<journal_instructions>` on `before_agent_start`
3. **questions**

Memory tools must be registered before the Routing preset's `before_agent_start` builds the dynamic appendix, so the appendix can list `memory-*` and `journal-*` tools when they are present.

## Tools

All tools invoke `hat --json [--namespace <id>] …` (see `cli-runner.ts`).

### Memory (`memory-*`)

| Tool | Purpose |
|------|---------|
| `memory-read` | Read node by URI or system URI (`system://boot`, `system://index`, …) |
| `memory-create` | Create child under parent URI |
| `memory-update` | Patch, append, or update metadata |
| `memory-delete` | Delete node by URI |
| `memory-search` | BM25-style search — use when URI is unknown |
| `memory-list` | Tree listing, optional domain filter |
| `memory-alias` | Create/remove alias paths |
| `memory-triggers` | Glossary keywords for lateral recall |
| `memory-history` | Version history for a node |
| `memory-domains` | List domains and counts |

### Journal (`journal-*`)

| Tool | Purpose |
|------|---------|
| `journal-write` | Append entry (scoped to project cwd) |
| `journal-read` | Read by timestamp id |
| `journal-search` | Search by text/tags |

Prompt text for agents lives under `src/extensions/memory/prompts/` (`memory-prompt.md`, `journal-prompt.md`).

## Routing preset

When the **Routing** primary-agent preset is active, `dynamic-appendix.ts` adds runtime guidance for registered `memory-*` / `journal-*` tools (boot read, `memory-search` vs guessing URIs).

## Shared database

The memory extension does not embed storage. It uses the hat CLI, which reads the same on-disk graph memory and journal stores as the hat application. Configure hat/data paths per hat's own documentation so CLI and GUI stay aligned.

## `/memory-status`

Slash command registered by the extension (available even when memory tools are disabled via env).

Reports:

- Whether the memory extension is enabled (`memory.enabled`, `DOTPI_MEMORY`)
- Resolved `memory.namespace` / hat `--namespace` (or default shared store)
- Resolved `hat` binary path (`HAT_CLI`, monorepo build, or `PATH`)
- CLI health (same check as startup: local binary or successful `memory domains`)
- Domain list from `hat memory domains` (count and per-domain node counts when present)

In the UI, output is shown as an **info** notification (see `primary-agent` / `dotpi-debug-dump` for the same pattern).

## `/self-improve`

Slash command that injects a structured reflection prompt as a **user message** (`pi.sendUserMessage`), so the agent runs the full self-improve workflow in a new turn.

| Usage | Behavior |
|-------|----------|
| `/self-improve` | Reflect on the entire visible session |
| `/self-improve <topic>` | Focus reflection on that area (e.g. `garage-api`) |

**Handler rules**

- If the agent is **not idle** (streaming / busy), shows a warning and does not send the message — finish the current turn first.
- If **the memory extension is disabled** (`memory.enabled: false` or `DOTPI_MEMORY=0`), shows a warning that `memory-*` / `journal-*` tools may be unavailable; reflection and skill steps can still run.
- Registered **before** the env disable early-return (like `/memory-status`), so the command exists even when `DOTPI_MEMORY` disables tools.

**Workflow (prompt content)**

1. **Reflect** — table of findings (memory, journal, skills); early exit if nothing substantial.
2. **Persist** — apply `memory-*` and `journal-*` changes without approval (when tools are enabled).
3. **Skills** — propose `SKILL.md` edits; require approval via the **`question`** tool before writing files. Skill paths follow Pi/dotpi layout (`skills/`, `~/.pi/agent/skills`, project `.pi/skills` / `.agents/skills`). If **plan** mode is on, exit plan or ensure write tools before editing skills.
4. **Summary** — report what was changed or skipped.

Template source: `src/extensions/memory/commands/self-improve-template.ts` (`SELF_IMPROVE_TEMPLATE`, `buildSelfImprovePrompt`).

## `/reorganize-memory`

Injects a full memory-tree audit prompt as a **user message** (same mechanism as `/self-improve`).

| Usage | Behavior |
|-------|----------|
| `/reorganize-memory` | Audit and reorganize the entire tree |
| `/reorganize-memory <uri-prefix>` | Limit scope (e.g. `tesla://`) |

**Handler rules**

- Agent must be **idle**; otherwise a warning is shown.
- **Requires** the memory extension enabled (unlike `/self-improve`, this command does not run when tools are disabled).
- Sets session namespace before sending the prompt.

**Workflow (prompt content)**

1. Inventory via `system://index`, per-node `memory-read`, `system://glossary`.
2. Structural analysis table (domain, parent, grouping, priority, disclosure, triggers).
3. Execute moves with create-then-delete protocol; update triggers and metadata.
4. Verify with `system://index` and report before/after.

Template source: `src/extensions/memory/commands/reorganize-memory-template.ts`.

## Permission gate and `memory-delete`

By default, **`memory-delete` is not blocked** — the agent can delete memory nodes when the extension and CLI are enabled.

To deny deletes (or any other tool name), add entries to `BLOCKED_TOOL_NAMES` in `src/extensions/permission-gate/settings.ts` (handled by `blocked-tool-names` gate). Example:

```ts
export const BLOCKED_TOOL_NAMES: readonly string[] = ["memory-delete"];
```

Other permission-gate rules (e.g. blocked `read` paths under `/run/agenix/`) are unchanged.

## Not covered here

`preloadBoot`, tool-usage telemetry integration, and in-process Rust embedding remain out of scope for this extension.
