import { basename } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
  Theme,
} from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { subagentStatuslineMarker } from "./agent-statusline.js";
import { readPrimaryAgentStatuslineBridge } from "./bridges.js";
import { GIT_REFRESH_TIMEOUT_MS, SHOW_DIRTY_MARKER } from "./settings.js";
import {
  getZaiUsageSnapshot,
  isCurrentModelZai,
} from "../../providers/zai/status.js";

const ZAI_ETA_DISPLAY_MAX = 14;
const PRIMARY_AGENT_STATUSLINE_LABEL_MAX = 22;

function primaryAgentStatuslineLabel(
  ctx: ExtensionContext,
): string | undefined {
  const sessionId = ctx.sessionManager.getSessionId();
  const raw =
    readPrimaryAgentStatuslineBridge()?.getCurrentPrimaryAgentDisplayName(
      sessionId,
    );
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  return truncateToWidth(trimmed, PRIMARY_AGENT_STATUSLINE_LABEL_MAX, "…");
}

function truncateZaiEta(s: string): string {
  if (s.length <= ZAI_ETA_DISPLAY_MAX) return s;
  return `${s.slice(0, ZAI_ETA_DISPLAY_MAX - 1)}…`;
}

function zaiUsagePlainSuffix(ctx: ExtensionContext): string {
  if (!isCurrentModelZai(ctx)) return "";
  const snap = getZaiUsageSnapshot();
  if (!snap) return " zai …";
  const p = Math.round(snap.percentage * 10) / 10;
  let out = ` zai ${p}%`;
  if (snap.timeRemaining) out += ` ${truncateZaiEta(snap.timeRemaining)}`;
  return out;
}

function zaiUsageColoredSuffix(
  ctx: ExtensionContext,
  theme: Pick<Theme, "fg">,
): string {
  if (!isCurrentModelZai(ctx)) return "";
  const snap = getZaiUsageSnapshot();
  if (!snap) return theme.fg("muted", " zai …");
  const p = Math.round(snap.percentage * 10) / 10;
  const colorToken =
    snap.percentage >= 90
      ? "error"
      : snap.percentage >= 70
        ? "warning"
        : "success";
  let out = ` ${theme.fg("muted", "zai")} ${theme.fg(colorToken, `${p}%`)}`;
  if (snap.timeRemaining) {
    out += theme.fg("dim", ` ${truncateZaiEta(snap.timeRemaining)}`);
  }
  return out;
}

export interface GitState {
  projectName: string;
  branch?: string;
  dirty: boolean;
  inLinkedWorktree: boolean;
}

function repoNameFromRemote(remote: string): string | undefined {
  const trimmed = remote.trim().replace(/\.git$/, "");
  const match = trimmed.match(/([^/:]+)$/);
  return match?.[1];
}

function formatModelName(ctx: ExtensionContext): string {
  const model = ctx.model;
  if (!model) return "no model";
  let name = model.name || model.id;
  name = name.replace(/^Claude\s+/i, "");
  name = name.replace(/^claude[-_]/i, "");
  name = name.replace(/[-_](20\d{6}|latest)$/i, "");
  name = name.replace(/^gpt[-_]/i, "GPT ");
  name = name.replace(/[-_]/g, " ");
  name = name.replace(/\bopus\b/i, "Opus");
  name = name.replace(/\bsonnet\b/i, "Sonnet");
  name = name.replace(/\bhaiku\b/i, "Haiku");
  name = name.replace(/\s+/g, " ").trim();
  name = name.replace(/\b(Opus|Sonnet|Haiku) (\d) (\d)\b/, "$1 $2.$3");
  return name;
}

type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
const THINKING_TOKEN: Record<
  ThinkingLevel,
  | "thinkingOff"
  | "thinkingMinimal"
  | "thinkingLow"
  | "thinkingMedium"
  | "thinkingHigh"
  | "thinkingXhigh"
> = {
  off: "thinkingOff",
  minimal: "thinkingMinimal",
  low: "thinkingLow",
  medium: "thinkingMedium",
  high: "thinkingHigh",
  xhigh: "thinkingXhigh",
};

function normalizeThinkingLevel(value: string | undefined): ThinkingLevel {
  switch ((value ?? "").toLowerCase()) {
    case "off":
      return "off";
    case "minimal":
      return "minimal";
    case "low":
      return "low";
    case "medium":
      return "medium";
    case "high":
      return "high";
    case "xhigh":
      return "xhigh";
    default:
      return "off";
  }
}

function formatWindow(tokens: number | undefined): string {
  if (!tokens || tokens <= 0) return "?";
  if (tokens >= 1_000_000) {
    const value = tokens / 1_000_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    const value = tokens / 1_000;
    return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}k`;
  }
  return `${tokens}`;
}

function statuslineContextInfo(ctx: ExtensionContext): {
  label: string;
  percent: number | null;
} {
  const usage = ctx.getContextUsage();
  const contextWindow = usage?.contextWindow ?? ctx.model?.contextWindow ?? 0;
  if (typeof usage?.percent !== "number")
    return { label: formatWindow(contextWindow), percent: null };
  const usedPercent = Math.max(0, Math.min(100, Math.round(usage.percent)));
  return { label: formatWindow(contextWindow), percent: 100 - usedPercent };
}

function isDefaultTrunkBranch(branch: string): boolean {
  const n = branch.trim().toLowerCase();
  return n === "main" || n === "master";
}

/**
 * Git branch segment for the statusline:
 * - Linked worktree: 🌳 + branch name
 * - Default trunk on primary worktree (`main` or `master`, case-insensitive): 🦀 only
 * - Any other branch on primary worktree: 🔀 + branch name
 */
function gitBadge(state: GitState, dirtyMarker: boolean): string {
  if (!state.branch) return "";
  const { branch, inLinkedWorktree, dirty } = state;
  const dirtyStar = dirty && dirtyMarker ? "*" : "";

  if (inLinkedWorktree) {
    return ` (🌳 ${branch}${dirtyStar})`;
  }
  if (isDefaultTrunkBranch(branch)) {
    return ` (🦀${dirtyStar})`;
  }
  return ` (🔀 ${branch}${dirtyStar})`;
}

export function makeFallbackGitState(cwd: string): GitState {
  return { projectName: basename(cwd), dirty: false, inLinkedWorktree: false };
}

async function runGit(
  pi: ExtensionAPI,
  cwd: string,
  args: string[],
): Promise<string | undefined> {
  try {
    const result = await pi.exec("git", ["-C", cwd, ...args], {
      timeout: GIT_REFRESH_TIMEOUT_MS,
    });
    if (result.code !== 0) return undefined;
    const stdout = result.stdout.trim();
    return stdout.length > 0 ? stdout : undefined;
  } catch {
    return undefined;
  }
}

export async function refreshGitState(
  pi: ExtensionAPI,
  ctx: ExtensionContext,
): Promise<GitState> {
  const cwd = ctx.cwd;
  const topLevel = await runGit(pi, cwd, ["rev-parse", "--show-toplevel"]);
  if (!topLevel) return makeFallbackGitState(cwd);
  const [remote, worktreesRaw, branchRaw, shortHead, diffExit] =
    await Promise.all([
      runGit(pi, cwd, ["remote", "get-url", "origin"]),
      runGit(pi, cwd, ["worktree", "list", "--porcelain"]),
      runGit(pi, cwd, ["branch", "--show-current"]),
      runGit(pi, cwd, ["rev-parse", "--short", "HEAD"]),
      pi
        .exec("git", ["-C", cwd, "diff-index", "--quiet", "HEAD", "--"], {
          timeout: GIT_REFRESH_TIMEOUT_MS,
        })
        .then((result) => result.code)
        .catch(() => 0),
    ]);
  const firstWorktreeLine = worktreesRaw
    ?.split("\n")
    .find((line) => line.startsWith("worktree "));
  const mainWorktree = firstWorktreeLine?.slice("worktree ".length).trim();
  const inLinkedWorktree = Boolean(mainWorktree && mainWorktree !== topLevel);
  const projectName =
    repoNameFromRemote(remote ?? "") ?? basename(mainWorktree || topLevel);
  const branch = branchRaw || shortHead;
  return { projectName, branch, dirty: diffExit === 1, inLinkedWorktree };
}

export function renderStatusLine(
  width: number,
  ctx: ExtensionContext,
  git: GitState,
  pi: ExtensionAPI,
  theme: Pick<Theme, "fg">,
): string {
  const { label: contextLabel, percent } = statuslineContextInfo(ctx);
  const gitAndProject = `${git.projectName}${gitBadge(git, SHOW_DIRTY_MARKER)}`;
  const modelChunk = formatModelName(ctx);
  const primaryLabel = primaryAgentStatuslineLabel(ctx);
  const primaryPlainPrefix = primaryLabel ? `${primaryLabel} ` : "";
  const projectChunk = `${primaryPlainPrefix}${gitAndProject} ${modelChunk}`;
  const statusSeparator = " / ";
  const thinkingLevel = normalizeThinkingLevel(pi.getThinkingLevel());
  const thinkingChunk = thinkingLevel;
  const contextChunk = ` ${contextLabel}`;
  const zaiPlain = zaiUsagePlainSuffix(ctx);
  const zaiColored = zaiUsageColoredSuffix(ctx, theme);
  const leftPlain = `${projectChunk}${statusSeparator}${thinkingChunk}${contextChunk}${zaiPlain}`;
  const percentPlain = percent === null ? "…%" : `${percent}%`;
  const subagentMarker = subagentStatuslineMarker(ctx.cwd);
  const rightPlain = subagentMarker
    ? `${percentPlain} ${subagentMarker.plain}`
    : percentPlain;
  const percentColor =
    percent === null
      ? "muted"
      : percent <= 15
        ? "error"
        : percent <= 30
          ? "warning"
          : "success";
  const separatorColored = theme.fg("muted", statusSeparator);
  const leftColored =
    (primaryLabel
      ? `${theme.fg("success", `${primaryLabel} `)}`
      : "") +
    `${theme.fg("accent", `${gitAndProject} `)}${theme.fg("accent", modelChunk)}${separatorColored}${theme.fg(THINKING_TOKEN[thinkingLevel], thinkingChunk)}${theme.fg("accent", contextChunk)}${zaiColored}`;
  const right = subagentMarker
    ? `${theme.fg(percentColor, percentPlain)} ${subagentMarker.styled}`
    : theme.fg(percentColor, percentPlain);
  const minimumGap = 1;
  const gapWidth = Math.max(
    minimumGap,
    width - visibleWidth(leftPlain) - visibleWidth(rightPlain) - 2,
  );
  const filled = percent === null ? 0 : Math.round(gapWidth * (percent / 100));
  const empty = Math.max(0, gapWidth - filled);
  const bar =
    percent === null
      ? " ".repeat(gapWidth)
      : `${theme.fg("error", "─".repeat(empty))}${theme.fg("warning", "─".repeat(filled))}`;
  return truncateToWidth(`${leftColored} ${bar} ${right}`, width, "");
}
