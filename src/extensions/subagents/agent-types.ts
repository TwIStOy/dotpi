import { DEFAULT_AGENTS } from "./default-agents.js";
import type { AgentConfig } from "./types.js";

export const BUILTIN_TOOL_NAMES: string[] = [
  "read",
  "bash",
  "edit",
  "write",
  "grep",
  "find",
  "ls",
];

const EXCLUDED_TOOL_NAMES = [
  "call_subagent",
  "get_subagent_result",
  "steer_subagent",
];

const MEMORY_TOOL_NAMES = ["read", "write", "edit"];
const READONLY_MEMORY_TOOL_NAMES = ["read"];

const agents = new Map<string, AgentConfig>();

function resolveKey(name: string): string | undefined {
  if (agents.has(name)) return name;
  const lower = name.toLowerCase();
  for (const key of agents.keys()) {
    if (key.toLowerCase() === lower) return key;
  }
  return undefined;
}

export function registerAgents(userAgents: Map<string, AgentConfig>): void {
  agents.clear();
  for (const [name, config] of DEFAULT_AGENTS) {
    agents.set(name, config);
  }
  for (const [name, config] of userAgents) {
    agents.set(name, config);
  }
}

export function resolveType(name: string): string | undefined {
  return resolveKey(name);
}

export function getAgentConfig(name: string): AgentConfig | undefined {
  const key = resolveKey(name);
  return key ? agents.get(key) : undefined;
}

export function getAvailableTypes(): string[] {
  return [...agents.entries()]
    .filter(([_, config]) => config.enabled !== false)
    .map(([name]) => name);
}

/** Enabled agents for extensions (e.g. primary-agent dynamic prompt). */
export function listEnabledAgents(): { name: string; config: AgentConfig }[] {
  return [...agents.entries()]
    .filter(([_, config]) => config.enabled !== false)
    .map(([name, config]) => ({ name, config }));
}

export function buildAgentListText(): string {
  return [...agents.entries()]
    .filter(([_, config]) => config.enabled !== false)
    .map(
      ([name, config]) => `- ${name}: ${config.trigger ?? config.description}`,
    )
    .join("\n");
}

export function getAllTypes(): string[] {
  return [...agents.keys()];
}

export function getDefaultAgentNames(): string[] {
  return [...agents.entries()]
    .filter(([_, config]) => config.isDefault === true)
    .map(([name]) => name);
}

export function getUserAgentNames(): string[] {
  return [...agents.entries()]
    .filter(([_, config]) => config.isDefault !== true)
    .map(([name]) => name);
}

export function isValidType(type: string): boolean {
  const key = resolveKey(type);
  if (!key) return false;
  return agents.get(key)?.enabled !== false;
}

export function getToolNamesForType(type: string): string[] {
  const key = resolveKey(type);
  const raw = key ? agents.get(key) : undefined;
  const config = raw?.enabled !== false ? raw : undefined;
  const names = config?.builtinToolNames?.length
    ? config.builtinToolNames
    : [...BUILTIN_TOOL_NAMES];
  return names;
}

export function getMemoryToolNames(existingToolNames: Set<string>): string[] {
  return MEMORY_TOOL_NAMES.filter((n) => !existingToolNames.has(n));
}

export function getReadOnlyMemoryToolNames(
  existingToolNames: Set<string>,
): string[] {
  return READONLY_MEMORY_TOOL_NAMES.filter((n) => !existingToolNames.has(n));
}

export function getConfig(type: string): {
  displayName: string;
  description: string;
  builtinToolNames: string[];
  extensions: true | string[] | false;
  skills: true | string[] | false;
  promptMode: "replace" | "append";
} {
  const key = resolveKey(type);
  const config = key ? agents.get(key) : undefined;
  if (config && config.enabled !== false) {
    return {
      displayName: config.displayName ?? config.name,
      description: config.description,
      builtinToolNames: config.builtinToolNames ?? BUILTIN_TOOL_NAMES,
      extensions: config.extensions,
      skills: config.skills,
      promptMode: config.promptMode,
    };
  }

  const gp = agents.get("general-purpose");
  if (gp && gp.enabled !== false) {
    return {
      displayName: gp.displayName ?? gp.name,
      description: gp.description,
      builtinToolNames: gp.builtinToolNames ?? BUILTIN_TOOL_NAMES,
      extensions: gp.extensions,
      skills: gp.skills,
      promptMode: gp.promptMode,
    };
  }

  return {
    displayName: "Agent",
    description: "General-purpose agent for complex, multi-step tasks",
    builtinToolNames: BUILTIN_TOOL_NAMES,
    extensions: true,
    skills: true,
    promptMode: "append",
  };
}

export { EXCLUDED_TOOL_NAMES };
