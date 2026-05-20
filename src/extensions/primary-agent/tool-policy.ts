import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";

/** Parsed from preset markdown frontmatter; `undefined` = do not change active tools */
export type PrimaryAgentToolPolicy = {
  /** If set and non-empty, only these tool names may stay active (must exist on `pi.getAllTools()`). */
  allowlist?: string[];
  /** Always applied after the allowlist step (or after “all tools” if no allowlist). */
  disallow: string[];
};

function parseStringList(val: unknown): string[] | undefined {
  if (val == null) return undefined;
  if (Array.isArray(val)) {
    const out = val
      .filter((x): x is string => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    return out.length > 0 ? out : undefined;
  }
  if (typeof val === "string") {
    const s = val.trim();
    if (!s || s === "none") return undefined;
    const items = s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }
  return undefined;
}

/**
 * Read `tools` / `disallowed_tools` from frontmatter (same field names as `.pi/agents` subagent prompts).
 * Returns `undefined` when both are absent / empty → preset does not touch the tool list.
 */
export function parseToolPolicyFromFrontmatter(
  fm: Record<string, unknown>,
): PrimaryAgentToolPolicy | undefined {
  const allowlist = parseStringList(fm.tools);
  const disallow = parseStringList(fm.disallowed_tools) ?? [];
  if (!allowlist?.length && disallow.length === 0) return undefined;
  return { allowlist, disallow };
}

export function resolveToolNamesForPolicy(
  pi: ExtensionAPI,
  policy: PrimaryAgentToolPolicy,
): { names: string[]; unknownAllow: string[] } {
  const all = pi.getAllTools().map((t) => t.name);
  const allSet = new Set(all);
  const deny = new Set(policy.disallow);
  const base = policy.allowlist?.length
    ? policy.allowlist.filter((n) => allSet.has(n))
    : [...all];
  const unknownAllow =
    policy.allowlist?.filter((n) => !allSet.has(n)) ?? [];
  const names = base.filter((n) => !deny.has(n));
  return { names, unknownAllow };
}

/**
 * Apply allow/deny policy to `pi.setActiveTools`. No-op when `policy` is undefined.
 * @returns whether `setActiveTools` was called
 */
export function applyPrimaryAgentToolPolicy(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
  policy: PrimaryAgentToolPolicy | undefined,
): boolean {
  if (!policy) return false;
  const { names, unknownAllow } = resolveToolNamesForPolicy(pi, policy);
  if (unknownAllow.length > 0 && ctx.hasUI) {
    ctx.ui.notify(
      `Primary-agent preset: unknown tool names (ignored): ${unknownAllow.join(", ")}`,
      "warning",
    );
  }
  if (names.length === 0) {
    if (ctx.hasUI) {
      ctx.ui.notify(
        "Primary-agent preset would enable zero tools; leaving the current tool list unchanged.",
        "warning",
      );
    }
    return false;
  }
  pi.setActiveTools(names);
  return true;
}
