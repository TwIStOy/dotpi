# Compaction

Port of upstream pi-qol **compaction**: custom `session_before_compact` summaries (markdown-shaped handoff), optional **`/tree`** branch summaries, and optional **idle** compaction after `agent_end`. Summaries always use the **session’s active model** (`ctx.model`).

## Files

| File             | Role                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------- |
| `index.ts`       | `initCompaction`; wires Pi events; idle timer + stale-context guards                           |
| `compaction.ts`  | Summarizer (`generateCompactionSummary`), `handleSessionCompaction`, `handleBranchSummary`   |
| `constants.ts`   | System prompt string and numeric defaults reused by `settings.ts`                           |
| `settings.ts`    | Static toggles (replace upstream `settingBoolean` / `settingNumber` / `settingString`)       |
| `util.ts`        | `stringifyError`, `isStaleCtxError`                                                           |

Compaction result metadata uses `source: "dotpi"` (not `pi-qol`).

Upstream reference: `pi-extensions/pi-qol/extensions/qol/compaction.ts` in the vanillagreencom/vstack repository.
