# Permission gate

Intercepts **`tool_call`** before execution and can **block** disallowed operations. Intended to grow with more gate functions over time.

## Current gates

| Gate | Behavior |
|------|----------|
| `readBlockedPrefixesGate` | Blocks **`read`** when the resolved path is under `READ_BLOCKED_PATH_PREFIXES` (default: agenix `/run/agenix`). Rejection text matches the agenix “decrypted secret” wording. |
| `bashAgenixCommandGate` | Blocks **`bash`** when the command matches `/\/run\/agenix\//` (shell access to the same tree). |

Relative `read` paths are resolved against `ctx.cwd`.

## Files

| File | Role |
|------|------|
| `index.ts` | `initPermissionGate`, install guard, `pi.on("tool_call", …)` |
| `gates.ts` | Ordered list of gate functions; `evaluateToolCallGates` |
| `constants.ts` | Agenix path constants + shared `REJECTED:` message builders |
| `gates/read-blocked-prefixes.ts` | Prefix-based `read` denylist |
| `gates/bash-agenix-command.ts` | Regex on `bash` command for `/run/agenix/` |
| `settings.ts` | `PERMISSION_GATE_ENABLED`, `READ_BLOCKED_PATH_PREFIXES` |
| `types.ts` | `BlockedToolCall`, `ToolCallGate` |

Register **`initPermissionGate` early** in `initExtensions` so gates run before other extensions that observe tool calls.
