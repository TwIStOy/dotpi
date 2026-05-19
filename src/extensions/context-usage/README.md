# Context usage (`/context`)

Port of upstream pi-qol **context usage** breakdown: `/context` sends a custom message (`dotpi.context-usage`) with estimated token counts by category (system prompt, tools, messages, etc.) and a small grid visualization.

## Files

| File               | Role                                                                                           |
| ------------------ | ---------------------------------------------------------------------------------------------- |
| `index.ts`         | Registers `/context`, message renderer, caches `systemPromptOptions` from `before_agent_start` |
| `context-usage.ts` | `buildContextUsageDetails`, `renderContextUsageMessage`, helpers                               |
| `constants.ts`     | `CONTEXT_USAGE_MESSAGE_TYPE` string                                                            |

Upstream reference: `pi-extensions/pi-qol/extensions/qol/context-usage.ts` in the vanillagreencom/vstack repository.
