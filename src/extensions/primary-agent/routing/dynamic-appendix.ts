import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import type { AgentConfig, SubagentRoutingHints } from "../../subagents/types.js";
import { listEnabledAgents } from "../../subagents/agent-types.js";

function routingKeyForAgentName(name: string): string {
  return name.trim().toLowerCase();
}

function routingHintsFor(config: AgentConfig): SubagentRoutingHints {
  return (
    config.routingHints ?? {
      cost: "CHEAP",
      category: "other",
      triggers: [],
    }
  );
}

type ToolCategory =
  | "lsp"
  | "ast"
  | "search"
  | "session"
  | "command"
  | "memory"
  | "journal"
  | "other";

function isMemoryToolName(name: string): boolean {
  return name.startsWith("memory-") || name.startsWith("memory_");
}

function isJournalToolName(name: string): boolean {
  return name.startsWith("journal-") || name.startsWith("journal_");
}

function categorizeTool(name: string): ToolCategory {
  if (name.startsWith("lsp_")) return "lsp";
  if (name.startsWith("ast_grep")) return "ast";
  if (name === "grep" || name === "find" || name === "glob") return "search";
  if (name.startsWith("session_")) return "session";
  if (name === "skill") return "command";
  if (isMemoryToolName(name)) return "memory";
  if (isJournalToolName(name)) return "journal";
  return "other";
}

function getToolsPromptDisplay(toolNames: string[]): string {
  const cats = toolNames.map((name) => ({ name, category: categorizeTool(name) }));
  const searchTools = cats.filter((t) => t.category === "search");
  const memoryTools = cats.filter((t) => t.category === "memory");
  const journalTools = cats.filter((t) => t.category === "journal");
  const lsp = cats.some((t) => t.category === "lsp");
  const ast = cats.some((t) => t.category === "ast");
  const parts: string[] = [];
  if (searchTools.length > 0) {
    parts.push(...searchTools.map((t) => `\`${t.name}\``));
  }
  if (lsp) parts.push("`lsp_*`");
  if (ast) parts.push("`ast_grep*`");
  if (memoryTools.length > 0) {
    parts.push(
      memoryTools.length === 1
        ? `\`${memoryTools[0]!.name}\` (+ other \`memory-*\`)`
        : "`memory-*`",
    );
  }
  if (journalTools.length > 0) {
    parts.push(
      journalTools.length === 1
        ? `\`${journalTools[0]!.name}\` (+ other \`journal-*\`)`
        : "`journal-*`",
    );
  }
  return parts.length > 0
    ? parts.join(", ")
    : "(no search/lsp/ast/memory tools detected)";
}

function buildGraphMemoryToolRows(toolNames: string[]): string[] {
  const memory = toolNames.filter(isMemoryToolName).sort();
  const journal = toolNames.filter(isJournalToolName).sort();
  const rows: string[] = [];
  if (memory.length > 0) {
    const list = memory.map((n) => `\`${n}\``).join(", ");
    rows.push(
      `- ${list} — **graph memory (dotcode)** — URI-addressed persistent memory shared with the dotcode app. On a new session, \`memory-read\` \`system://boot\` before other work. Use \`memory-search\` with keywords when you do not know the URI; do not invent \`domain://\` paths.`,
    );
  }
  if (journal.length > 0) {
    const list = journal.map((n) => `\`${n}\``).join(", ");
    rows.push(
      `- ${list} — **journal** — append-only project log for discoveries, decisions, and failed attempts.`,
    );
  }
  return rows;
}

const COST_ORDER: Record<SubagentRoutingHints["cost"], number> = {
  FREE: 0,
  CHEAP: 1,
  EXPENSIVE: 2,
};

function buildKeyTriggersSection(
  enabled: { name: string; config: AgentConfig }[],
): string {
  const lines: string[] = [];
  for (const { name, config } of enabled) {
    const meta = config.routingHints;
    if (meta?.keyTrigger) {
      lines.push(`- ${meta.keyTrigger} (\`${name}\`)`);
    }
  }
  if (lines.length === 0) return "";
  return `### Key triggers (check before classification)

${lines.join("\n")}
- **"Look into" + "create PR"** → Not just research; user may expect a full implementation cycle once they explicitly ask to ship.`;
}

function buildToolSelectionTable(
  pi: ExtensionAPI,
  enabled: { name: string; config: AgentConfig }[],
): string {
  const toolNames = pi.getAllTools().map((t) => t.name);
  const toolLine = getToolsPromptDisplay(toolNames);
  const graphRows = buildGraphMemoryToolRows(toolNames);

  const rows: string[] = ["### Tool & agent selection", ""];
  rows.push(
    `- ${toolLine} — **direct tools** — use when scope is clear and delegation overhead is not worth it.`,
  );
  for (const row of graphRows) {
    rows.push(row);
  }

  const sorted = [...enabled]
    .map((e) => ({ ...e, meta: routingHintsFor(e.config) }))
    .filter((e) => e.meta.category !== "utility")
    .sort(
      (a, b) =>
        COST_ORDER[a.meta.cost] - COST_ORDER[b.meta.cost] ||
        a.name.localeCompare(b.name),
    );

  for (const { name, config, meta } of sorted) {
    const short =
      config.description.split(/(?<=[.!?])\s/)[0] ||
      config.description.slice(0, 120);
    rows.push(`- \`${name}\` subagent — **${meta.cost}** — ${short}`);
  }
  rows.push("");
  rows.push(
    "**Default flow:** `Explore` / `Librarian` (often `run_in_background: true`) + direct tools → `Oracle` when you need read-only high-IQ review → implement or delegate execution.",
  );
  return rows.join("\n");
}

function buildExploreSection(
  enabled: { name: string; config: AgentConfig }[],
): string {
  const ex = enabled.find((e) => routingKeyForAgentName(e.name) === "explore");
  if (!ex) return "";
  const meta = routingHintsFor(ex.config);
  const use = meta.useWhen ?? [];
  const avoid = meta.avoidWhen ?? [];
  if (use.length === 0 && avoid.length === 0) return "";
  return `### Explore subagent = contextual grep (internal)

Use **call_subagent** with \`subagent_type="${ex.name}"\` as a **peer** capability, not a fallback. Fire in parallel for discovery.

**Delegation trust:** once you launch Explore for a search, **do not** manually repeat the same search unless you intentionally skipped coverage.

**Use direct tools when:**
${avoid.map((s) => `- ${s}`).join("\n")}

**Use Explore when:**
${use.map((s) => `- ${s}`).join("\n")}`;
}

function buildLibrarianSection(
  enabled: { name: string; config: AgentConfig }[],
): string {
  const lib = enabled.find((e) => routingKeyForAgentName(e.name) === "librarian");
  if (!lib) return "";
  const meta = routingHintsFor(lib.config);
  const use = meta.useWhen ?? [];
  if (use.length === 0) return "";
  return `### Librarian subagent = reference grep (external)

Search **external** references (docs, OSS, upstream behaviour). Fire when unfamiliar libraries matter.

**Trigger phrases** (typical Librarian launches):
${use.map((s) => `- "${s}"`).join("\n")}

Use **call_subagent** with \`subagent_type="${lib.name}"\`, usually \`run_in_background: true\`, with the same rich prompt structure as Explore (context, goal, downstream use, concrete search request).`;
}

function buildDelegationTable(
  enabled: { name: string; config: AgentConfig }[],
): string {
  const rows: string[] = ["### Delegation table", ""];
  for (const { name, config } of enabled) {
    const meta = routingHintsFor(config);
    const triggers =
      meta.triggers.length > 0
        ? meta.triggers
        : [
            {
              domain: name,
              trigger: config.trigger ?? config.description.slice(0, 160),
            },
          ];
    for (const t of triggers) {
      rows.push(`- **${t.domain}** → \`${name}\` — ${t.trigger}`);
    }
  }
  return rows.join("\n");
}

function buildOracleSection(
  enabled: { name: string; config: AgentConfig }[],
): string {
  const o = enabled.find((e) => routingKeyForAgentName(e.name) === "oracle");
  if (!o) return "";
  const meta = routingHintsFor(o.config);
  const use = meta.useWhen ?? [];
  const avoid = meta.avoidWhen ?? [];
  return `<Oracle_usage>
## Oracle — read-only high-IQ consultant

Oracle is **read-only**, expensive, and for debugging / architecture. Consultation only.

### When to consult Oracle first, then implement

${use.map((s) => `- ${s}`).join("\n")}

### When not to consult

${avoid.map((s) => `- ${s}`).join("\n")}

### Pi usage pattern

Briefly say you are consulting Oracle before invoking **call_subagent** with \`subagent_type="${o.name}"\`.

**Collect Oracle before your final answer** when implementation depends on Oracle’s direction.

- While Oracle runs in background: only **non-overlapping** prep; do not ship decisions Oracle was meant to make.
- Use **get_subagent_result** with the returned \`agent_id\` (e.g. \`wait: true\` when you must block). Do not busy-loop; if still running, end your turn and check later when appropriate.
- Prefer **resume** with the same agent id for Oracle follow-ups.
</Oracle_usage>`;
}

function buildFrontendGuidanceSection(): string {
  return `### Frontend tasks (when you touch UI yourself)

Avoid generic AI-SaaS aesthetics. Prefer a clear visual direction with CSS variables (no purple-on-white default). Use purposeful typography rather than default stacks only. Add atmosphere with gradients or subtle patterns instead of flat single-color pages. A few meaningful animations beat generic micro-motion. Verify desktop and mobile. If a design system exists in-repo, follow it.`;
}

function buildNonClaudePlannerSection(modelId: string): string {
  const isClaude = modelId.toLowerCase().includes("claude");
  if (isClaude || !modelId) return "";
  return `### Plan subagent dependency (non-Claude models)

Multi-step or ambiguous work? **Consult Plan first** before large implementation.

- Single-file / trivial fix → proceed directly.
- Otherwise → **call_subagent** with \`subagent_type="Plan"\` **before** broad edits (match exact registry spelling from the delegation table).
- Use **resume** on the same Plan agent id for follow-up questions.

If anything is still ambiguous after Plan, ask the user instead of guessing.`;
}

function buildParallelDelegationSection(
  modelId: string,
  enabled: { name: string; config: AgentConfig }[],
): string {
  const isClaude = modelId.toLowerCase().includes("claude");
  if (isClaude || !modelId) return "";
  const hasHeavy = enabled.some(
    (e) => routingKeyForAgentName(e.name) === "general-purpose",
  );
  if (!hasHeavy) return "";

  return `### Decompose and delegate (non-Claude)

Your failure mode is doing large implementation yourself instead of splitting work across **call_subagent** calls.

- Decompose into independent units; launch **multiple** \`run_in_background: true\` agents when work is parallelizable.
- **general-purpose** carries tuned prompts and tools — use it for heavy implementation, not ad-hoc shortcuts.

**Each delegation prompt** must include: goal + success criteria + paths/constraints + MUST DO / MUST NOT + context.

Vague one-line delegations produce vague results.`;
}

function buildPiDelegationGuide(enabled: { name: string; config: AgentConfig }[]): string {
  const types = enabled.map((e) => e.name).join(", ");
  return `### Pi / dotpi — \`call_subagent\` instead of OpenCode \`task()\`

OpenAgent combines **categories** + \`load_skills\` on \`task()\`. Pi uses **call_subagent** with:

- \`subagent_type\` — one of: ${types || "(none registered)"}
- \`description\`, \`prompt\`, optional \`model\`, \`thinking\`, \`max_turns\`, \`run_in_background\`, \`resume\`, \`isolated\`, \`inherit_context\`, \`isolation\`

Put **skill names and constraints inside the \`prompt\` text** (and rely on project skills loading rules). Empty, unjustified delegations without skill/context guidance are an anti-pattern.

**Skills:** follow Pi skill discovery for this session/repo; when a skill clearly matches the task domain, say so in the delegation prompt and follow the skill’s workflow.`;
}

function buildHardBlocksSection(): string {
  const blocks = [
    "Type error suppression (`as any`, `@ts-ignore`, `@ts-expect-error`) — **never** as a substitute for real fixes",
    "Commit without explicit user request — **never**",
    "Speculate about unread code — **never**",
    "Leave the repo broken after repeated failures — **never**",
    "Delivering a final answer before collecting Oracle / background **call_subagent** results you depended on — **never**",
  ];
  return `## Hard blocks (never violate)

${blocks.map((b) => `- ${b}`).join("\n")}`;
}

function buildAntiPatternsSection(): string {
  const patterns = [
    "**Type safety:** hiding errors with `as any` / blanket ts-ignore",
    "**Testing:** deleting failing tests to “pass”",
    "**Search:** firing Explore/Librarian then redoing the same search yourself",
    "**Background agents:** spinning on **get_subagent_result** in a tight loop — prefer `wait: true` or end turn and check later",
    "**Oracle:** answering while Oracle is still needed and unfinished",
  ];
  return `## Anti-patterns (blocking)

${patterns.map((p) => `- ${p}`).join("\n")}`;
}

function buildAntiDuplicationSection(): string {
  return `<Anti_duplication>
## Anti-duplication (critical)

After delegating exploration to **Explore** / **Librarian**, **do not** perform the same search yourself.

**Forbidden:** launching agents then grepping the same question “just to check”.

**Allowed:** non-overlapping work, unrelated files, setup that does not depend on delegated results.

When you need delegated results that are not ready: finish independent work, then **end your turn**; use **get_subagent_result** on the next cycle with the \`agent_id\` you received.
</Anti_duplication>`;
}

function buildUltraworkStyleSection(
  enabled: { name: string; config: AgentConfig }[],
): string {
  const lines: string[] = ["### Registered subagents (this session)"];
  const priority = ["explore", "librarian", "plan", "oracle", "general-purpose"];
  const sorted = [...enabled].sort((a, b) => {
    const ia = priority.indexOf(routingKeyForAgentName(a.name));
    const ib = priority.indexOf(routingKeyForAgentName(b.name));
    if (ia === -1 && ib === -1) return a.name.localeCompare(b.name);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  for (const { name, config } of sorted) {
    const desc =
      config.description.length > 140
        ? `${config.description.slice(0, 137)}...`
        : config.description;
    const suffix =
      routingKeyForAgentName(name) === "explore" ||
      routingKeyForAgentName(name) === "librarian"
        ? " (often multiple in parallel)"
        : "";
    lines.push(`- \`${name}\`${suffix}: ${desc}`);
  }
  return lines.join("\n");
}

function buildToolCallFormatSection(): string {
  return `## Tool call format (critical)

Use the **native tool-calling interface** Pi provides. Do **not** paste tool calls as plain text or fake JSON in the chat transcript.`;
}

/**
 * Runtime appendix aligned with Oh My OpenAgent `dynamic-agent-prompt-builder`
 * (live tools + registered agents + current model), adapted to Pi.
 */
export function buildRoutingDynamicAppendix(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): string {
  const enabled = listEnabledAgents();
  const modelId = ctx.model?.id ?? "";

  const chunks: string[] = [
    "## [Runtime] Routing dynamic appendix",
    "*Generated at `before_agent_start` — mirrors Oh My OpenAgent `dynamic-agent-prompt-builder` sections (tools, agents, model branches, policies), adapted for Pi `call_subagent` / `get_subagent_result` / `steer_subagent`.*",
  ];

  const kt = buildKeyTriggersSection(enabled);
  if (kt) chunks.push(kt);

  chunks.push(buildToolSelectionTable(pi, enabled));

  const ex = buildExploreSection(enabled);
  if (ex) chunks.push(ex);

  const lib = buildLibrarianSection(enabled);
  if (lib) chunks.push(lib);

  chunks.push(buildDelegationTable(enabled));

  const ora = buildOracleSection(enabled);
  if (ora) chunks.push(ora);

  chunks.push(buildFrontendGuidanceSection());

  const planner = buildNonClaudePlannerSection(modelId);
  if (planner) chunks.push(planner);

  const par = buildParallelDelegationSection(modelId, enabled);
  if (par) chunks.push(par);

  chunks.push(buildPiDelegationGuide(enabled));
  chunks.push(buildUltraworkStyleSection(enabled));
  chunks.push(buildHardBlocksSection());
  chunks.push(buildAntiPatternsSection());
  chunks.push(buildAntiDuplicationSection());
  chunks.push(buildToolCallFormatSection());

  return chunks.filter(Boolean).join("\n\n");
}