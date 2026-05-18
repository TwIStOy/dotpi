# Pi Extension Events

## Full Event Catalog

### Resource Events
| Event | Purpose |
|---|---|
| `resources_discover` | Contribute skill/prompt/theme paths |

### Session Events
| Event | Can Cancel? | Purpose |
|---|---|---|
| `session_start` | No | Session started/loaded/reloaded. `reason`: "startup" / "new" / "resume" / "fork" |
| `session_before_switch` | Yes | Before `/new` or `/resume` |
| `session_before_fork` | Yes | Before `/fork` or `/clone` |
| `session_before_compact` | Yes | Can customize compaction summary |
| `session_compact` | No | Compaction completed |
| `session_before_tree` | Yes | Before tree navigation |
| `session_tree` | No | After tree navigation |
| `session_shutdown` | No | Before extension teardown |

### Agent Events
| Event | Purpose |
|---|---|
| `before_agent_start` | Inject message, modify system prompt |
| `agent_start` / `agent_end` | Per-prompt lifecycle |
| `turn_start` / `turn_end` | Per-turn lifecycle |
| `message_start` / `message_update` / `message_end` | Message streaming |
| `context` | Modify messages before each LLM call |
| `before_provider_request` | Inspect/replace provider payload |
| `after_provider_response` | HTTP status/headers after response |

### Model Events
| Event | Purpose |
|---|---|
| `model_select` | Model changed |
| `thinking_level_select` | Thinking level changed |

### Tool Events
| Event | Mutable? | Purpose |
|---|---|---|
| `tool_call` | `event.input` mutable, can block | Before tool executes |
| `tool_result` | Can return modified result | After tool execution |
| `tool_execution_start` / `tool_execution_update` / `tool_execution_end` | No | Tool execution lifecycle |

### User Events
| Event | Purpose |
|---|---|
| `user_bash` | Intercept `!` or `!!` commands |
| `input` | Intercept/transform/handle user input |

## Lifecycle Flow

```
pi starts
  ├── session_start { reason: "startup" }
  ├── resources_discover { reason: "startup" }
  │
user sends prompt
  ├── (extension commands checked first)
  ├── input (intercept/transform/handle)
  ├── (skill/template expansion if not handled)
  ├── before_agent_start (inject msg, modify system prompt)
  ├── agent_start
  │   └── turn loop:
  │       ├── turn_start
  │       ├── context (modify messages)
  │       ├── before_provider_request
  │       ├── after_provider_response
  │       │   └── LLM may call tools:
  │       │       ├── tool_execution_start
  │       │       ├── tool_call (can block, mutate input)
  │       │       ├── tool_execution_update
  │       │       ├── tool_result (can modify)
  │       │       └── tool_execution_end
  │       └── turn_end
  └── agent_end

/new or /resume:
  ├── session_before_switch (can cancel)
  ├── session_shutdown
  ├── session_start { reason: "new" | "resume" }
  └── resources_discover

exit:
  └── session_shutdown
```

## Input Processing Order

1. Extension commands (`/cmd`) — if found, handler runs, input event skipped
2. `input` event — can intercept, transform, or handle
3. Skill commands (`/skill:name`) expanded
4. Prompt templates (`/template`) expanded
5. Agent processing begins

## Input Event Return Values
- `{ action: "continue" }` — pass through (default)
- `{ action: "transform", text: "..." }` — modify text, continue
- `{ action: "handled" }` — skip agent entirely (first handler wins)

## Tool Call Event Behavior
- `event.input` is mutable — mutations affect actual execution
- Later handlers see mutations from earlier handlers
- No re-validation after mutation
- Return `{ block: true, reason?: string }` to block

## Tool Result Chaining
- Handlers run in extension load order
- Each handler sees latest result after previous changes
- Can return partial patches (`content`, `details`, `isError`)

## Message Delivery Modes
| Mode | Behavior |
|---|---|
| `"steer"` (default) | Queued while streaming; delivered after current turn finishes tools |
| `"followUp"` | Waits for agent to finish all tools before delivery |
| `"nextTurn"` | Queued for next user prompt, does not interrupt |
| `triggerTurn: true` | If agent idle, trigger LLM response immediately |
