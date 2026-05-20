# dotcode-memory (dotpi extension)

The **dotcode-memory** extension connects Pi Coding Agent sessions to the same graph memory and journal database used by the [dotcode](https://github.com/) desktop app. Agents read and write memories through the `dotcode` CLI; there is no separate in-process database in dotpi.

## Requirements

- **dotcode binary** on `PATH`, or:
  - **`DOTCODE_CLI`** — absolute path to the `dotcode` executable, or
  - A local build under the dotcode repo (`tool/target/release/dotcode` or `result/bin/dotcode`) when developing monorepo-style layouts.

If the binary is missing, dotpi shows a **one-time warning per process** on the first `session_start` (when the extension is enabled).

## Enable / disable

| Mechanism | Effect |
|-----------|--------|
| Default | Extension **enabled** |
| Pi settings `dotcodeMemory.enabled: false` | No tools, no memory/journal system prompt appendix |
| `DOTPI_DOTCODE_MEMORY=0` (or `false` / `off`) | Disabled for the whole process before any session |

Settings key (in project or user Pi settings, via `settingsManager.getProjectSettings()`):

```json
{
  "dotcodeMemory": {
    "enabled": true,
    "namespace": ""
  }
}
```

| Field | Default | Description |
|-------|---------|-------------|
| `enabled` | `true` | Register memory/journal tools and append prompts |
| `namespace` | `""` | Passed to dotcode as global `--namespace` (see below) |

Only alphanumeric characters, `_`, and `-` are allowed in `namespace`; invalid values are treated as empty (shared default store).

See `src/extensions/dotcode-memory/settings.ts` for `DOTCODE_MEMORY_SETTINGS_KEY` and `getDotcodeNamespace()`.

### Namespace (multi-agent isolation)

dotcode supports a global CLI flag `--namespace <id>` so separate agents or sessions can use isolated memory/journal views without changing on-disk layout manually.

In dotpi, set per-project (or user) Pi settings:

```json
{
  "dotcodeMemory": {
    "enabled": true,
    "namespace": "routing-agent"
  }
}
```

Every tool invocation runs the CLI as:

`dotcode --json [--namespace <id>] memory …` / `journal …`

The active namespace is stored for the session on `session_start` and refreshed on `before_agent_start`. Use `/memory-status` to see the resolved namespace and domain list for that scope.

**Note:** Journal entries still include `--project` (cwd); namespace isolates dotcode’s logical store, not the project path.

## Initialization order

dotpi loads extensions from `src/extensions/index.ts`. Relevant order:

1. **Subagents**, **tool-renderer**, **primary-agent** (Routing preset + dynamic appendix)
2. **dotcode-memory** — registers tools on `session_start` when enabled; appends `<memory_instructions>` / `<journal_instructions>` on `before_agent_start`
3. **questions**

Memory tools must be registered before the Routing preset’s `before_agent_start` builds the dynamic appendix, so the appendix can list `memory-*` and `journal-*` tools when they are present.

## Tools

All tools invoke `dotcode --json [--namespace <id>] …` (see `cli-runner.ts`).

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

Prompt text for agents lives under `src/extensions/dotcode-memory/prompts/` (`memory-prompt.md`, `journal-prompt.md`).

## Routing preset

When the **Routing** primary-agent preset is active, `dynamic-appendix.ts` adds runtime guidance for registered `memory-*` / `journal-*` tools (boot read, `memory-search` vs guessing URIs).

## Shared database

dotcode-memory does not embed storage. It uses the dotcode CLI, which reads the same on-disk graph memory and journal stores as the dotcode application. Configure dotcode/data paths per dotcode’s own documentation so CLI and GUI stay aligned.

## `/memory-status`

Slash command registered by the extension (available even when memory tools are disabled via env).

Reports:

- Whether dotcode-memory is enabled (`dotcodeMemory.enabled`, `DOTPI_DOTCODE_MEMORY`)
- Resolved `dotcodeMemory.namespace` / dotcode `--namespace` (or default shared store)
- Resolved `dotcode` binary path (`DOTCODE_CLI`, monorepo build, or `PATH`)
- CLI health (same check as startup: local binary or successful `memory domains`)
- Domain list from `dotcode memory domains` (count and per-domain node counts when present)

In the UI, output is shown as an **info** notification (see `primary-agent` / `dotpi-debug-dump` for the same pattern).

## Permission gate and `memory-delete`

By default, **`memory-delete` is not blocked** — the agent can delete memory nodes when the extension and CLI are enabled.

To deny deletes (or any other tool name), add entries to `BLOCKED_TOOL_NAMES` in `src/extensions/permission-gate/settings.ts` (handled by `blocked-tool-names` gate). Example:

```ts
export const BLOCKED_TOOL_NAMES: readonly string[] = ["memory-delete"];
```

Other permission-gate rules (e.g. blocked `read` paths under `/run/agenix/`) are unchanged.

## Not covered here

`preloadBoot`, tool-usage telemetry integration, and in-process Rust embedding remain out of scope for this extension.