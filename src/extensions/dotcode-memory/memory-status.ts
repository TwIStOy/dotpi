import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import {
  dotcodeInstallHint,
  isDotcodeBinaryAvailable,
} from "./cli-health.js";
import { getDotcodeBinaryPath, runDotcode } from "./cli-runner.js";
import {
  isDisabledByEnv,
  isDotcodeMemoryEnabled,
} from "./settings.js";

function formatDomainEntry(entry: unknown): string {
  if (typeof entry === "string") return `  - ${entry}`;
  if (!entry || typeof entry !== "object") return `  - ${String(entry)}`;
  const o = entry as Record<string, unknown>;
  const name =
    (typeof o.name === "string" && o.name) ||
    (typeof o.domain === "string" && o.domain) ||
    (typeof o.id === "string" && o.id) ||
    "?";
  const count =
    typeof o.count === "number"
      ? o.count
      : typeof o.node_count === "number"
        ? o.node_count
        : undefined;
  return count !== undefined
    ? `  - ${name} (${count} nodes)`
    : `  - ${name}`;
}

function formatDomainsResult(result: unknown): string {
  if (result && typeof result === "object" && "error" in result) {
    const err = (result as { error?: unknown }).error;
    return `Domains: error — ${String(err)}`;
  }

  let list: unknown[] = [];
  if (Array.isArray(result)) {
    list = result;
  } else if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    if (Array.isArray(r.domains)) list = r.domains;
    else if (Array.isArray(r.data)) list = r.data;
  }

  if (list.length === 0) {
    const preview =
      typeof result === "string"
        ? result.slice(0, 200)
        : JSON.stringify(result)?.slice(0, 200);
    return `Domains: no list in CLI response (${preview ?? "empty"})`;
  }

  return [
    `Domains: ${list.length} registered`,
    ...list.map(formatDomainEntry),
  ].join("\n");
}

/**
 * Build multi-line status for `/memory-status` (also suitable for notify).
 */
export async function buildMemoryStatusReport(
  ctx: ExtensionCommandContext,
): Promise<string> {
  if (isDisabledByEnv()) {
    return (
      "dotcode-memory: disabled for this process (DOTPI_DOTCODE_MEMORY=0 / false / off)."
    );
  }

  if (!isDotcodeMemoryEnabled(ctx)) {
    return (
      "dotcode-memory: disabled in project settings (dotcodeMemory.enabled: false)."
    );
  }

  const lines: string[] = ["dotcode-memory: enabled"];

  const bin = getDotcodeBinaryPath();
  const resolved =
    bin === "dotcode" ? "dotcode (PATH)" : `resolved: ${bin}`;
  lines.push(`CLI: ${resolved}`);

  const available = await isDotcodeBinaryAvailable();
  if (available) {
    lines.push("CLI health: OK (binary found or `memory domains` succeeded)");
  } else {
    lines.push("CLI health: not available");
    lines.push(dotcodeInstallHint());
  }

  if (available) {
    try {
      const domains = await runDotcode(["memory", "domains"]);
      lines.push(formatDomainsResult(domains));
    } catch (e) {
      lines.push(`Domains: ${String(e)}`);
    }
  } else {
    lines.push("Domains: skipped (CLI unavailable)");
  }

  return lines.join("\n");
}