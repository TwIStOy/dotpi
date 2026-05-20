# Primary agent presets

Each preset is one markdown file. Slugs are listed in `prompt-manifest.ts` as `PRIMARY_AGENT_PRESET_SLUGS`. Most presets live under `prompts/<slug>.md`; the **Routing** preset lives under `routing/prompts/routing.md` (see `routing/README.md`).

**Default for the main session:** On each `session_start`, **Routing** is applied automatically unless the user has run `/primary-agent default` (or `reset` / `clear`) for that session to stay on Pi’s built-in prompt and tools.

Optional YAML frontmatter:

- `label` or `title` — shown in `/primary-agent` menu (defaults to the slug).
- `tools` — allowlist of tool names (comma-separated string, YAML string, or YAML list of strings). When set and non-empty, only these tools stay enabled (names must exist on the session). When omitted, all registered tools are candidates before `disallowed_tools` is applied.
- `disallowed_tools` — blocklist (same formats as `tools`). Applied after the allowlist step.

If both `tools` and `disallowed_tools` are absent or empty, the preset does **not** change the active tool list (only the system prompt from the body).

- `dynamic_appendix` — optional. `routing` appends a **runtime-generated** block at each `before_agent_start` (live `pi.getAllTools()`, registered subagents from `listEnabledAgents()`, current `ctx.model`), aligned with Oh My OpenAgent `dynamic-agent-prompt-builder`. Preset slug **`routing`** defaults to this unless you set `dynamic_appendix: none` (or `off` / `false`). Legacy frontmatter value `sisyphus` is accepted as an alias for `routing`.

Body (after frontmatter) is the base system prompt; the dynamic appendix is concatenated after a `---` separator when enabled.

Implementation for Routing: `routing/dynamic-appendix.ts`. Subagent-specific routing tables use optional **`routingHints`** on each `AgentConfig` (see `src/extensions/subagents/types.ts`), filled in default agents under `default-agents/` and optional YAML **`routing_hints`** in `.pi/agents/*.md` frontmatter for custom agents. Optional `{{VAR}}` in the body is supported if you extend the loader to pass `vars` (same idea as subagents).

Example shipped preset: **`routing/prompts/routing.md`** (orchestrator preset **Routing**, evolved from Oh My OpenAgent Sisyphus).

Example additional preset `prompts/concise.md`:

```markdown
---
label: Concise replies
tools: read, grep, find, ls
disallowed_tools: bash
---

You answer in short bullet points unless the user asks for detail.
```

Then add `"my-slug"` to `PRIMARY_AGENT_PRESET_SLUGS` in `prompt-manifest.ts` and mirror it in `scripts/check-primary-agent-prompts.mjs` (`REQUIRED`). If the preset file is not under `prompts/`, update `promptFilePathForSlug` in `prompt-loader.ts` and the copy script in `package.json` accordingly.
