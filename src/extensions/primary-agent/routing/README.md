# Routing preset (primary-agent)

Runtime **Routing** orchestrator for Pi: base prompt in `prompts/routing.md` and a runtime appendix in `dynamic-appendix.ts` (live tools, enabled subagents, model). Per-subagent routing metadata (cost, triggers, use/avoid) lives on **`AgentConfig.routingHints`** or custom-agent frontmatter **`routing_hints`**, not in this folder.

Preset slug: **`routing`** (`/primary-agent routing`).

## Custom agents (`.pi/agents/*.md`)

Optional YAML block **`routing_hints`** is parsed into `AgentConfig.routingHints` (same shape as built-in defaults). If omitted or invalid, Routing still works using generic fallbacks from `description` / `trigger`.

```yaml
routing_hints:
  cost: CHEAP # FREE | CHEAP | EXPENSIVE
  category: exploration # utility | exploration | advisor | other
  key_trigger: "When to reach for this agent in one line"
  triggers:
    - domain: Short label
      trigger: When to delegate
  use_when:
    - Bullet one
  avoid_when:
    - Bullet one
```
