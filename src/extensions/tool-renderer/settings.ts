/**
 * Static configuration for the tool-renderer extension (not read from settings.json).
 * Change behavior by editing this file only.
 */
export const toolRendererSettings = {
  rightMarginGuard: true,
  stackToolCalls: false,
  stackChildDisplay: "rows" as "rows" | "headline" | "anchor-list",

  readOutputMode: "preview" as "hidden" | "summary" | "preview",
  searchOutputMode: "preview" as "hidden" | "count" | "preview",
  bashOutputMode: "opencode" as "hidden" | "summary" | "opencode" | "preview",
  bashLiveOutputDelayMs: 1000,
  bashLiveTailLines: 4,
  mcpOutputMode: "preview" as "hidden" | "summary" | "preview",
  treeStyle: "unicode" as "unicode" | "ascii",
  pendingStatusAnimation: false,
  diffBackgrounds: true,
  renderBashDiffs: false,
  toolChrome: "outlines" as "off" | "transparent" | "outlines",

  renderMutationTools: false,
  registerBatchTool: true,

  bashPreviewLines: 80,
  readPreviewLines: 80,
  searchPreviewLines: 80,
  bashCollapsedLines: 10,

  maxLineWidth: 1000,
  commandPreviewChars: 96,

  batchMaxCalls: 8,
  batchCallTimeoutMs: 120_000,

  applyPatchRenderer: true,
  genericToolRenderers: true,
  workingIndicator: "default" as "default" | "pulse" | "hidden",

  userMessageTrailingBlankLine: true,
  compactUserMessages: true,
  alignAssistantMessages: true,
  compactCompactionMessages: true,
  compactSkillMessages: true,
  styledCodeBlocks: true,

  shikiDiffs: true,
  showDiffHunkMeta: true,
  wordDiffHighlights: true,
  splitDiffs: true,
  renderGitDiffCommandDiffs: false,
  mutationCallPreview: true,
  mutationCallPreviewLines: 16,
  diffExpandedLines: 4000,
  diffPreviewLines: 24,

  applyPatchPreviewLines: 18,
  mcpPreviewLines: 80,
} as const;

export type StackChildDisplay = "rows" | "headline" | "anchor-list";

export function rightMarginGuardEnabled(_cwd?: string): boolean {
  return toolRendererSettings.rightMarginGuard;
}

export function stackToolCalls(_cwd?: string): boolean {
  return toolRendererSettings.stackToolCalls;
}

export function stackChildDisplay(_cwd?: string): StackChildDisplay {
  return toolRendererSettings.stackChildDisplay;
}

export function stackShell(_cwd?: string): { renderShell?: "self" } {
  return stackToolCalls() ? { renderShell: "self" } : {};
}

export type ReadOutputMode = "hidden" | "summary" | "preview";
export type SearchOutputMode = "hidden" | "count" | "preview";
export type BashOutputMode = "hidden" | "summary" | "opencode" | "preview";
export type McpOutputMode = "hidden" | "summary" | "preview";

export function readOutputMode(_cwd?: string): ReadOutputMode {
  return toolRendererSettings.readOutputMode;
}

export function searchOutputMode(_cwd?: string): SearchOutputMode {
  return toolRendererSettings.searchOutputMode;
}

export function bashOutputMode(_cwd?: string): BashOutputMode {
  return toolRendererSettings.bashOutputMode;
}

export function bashLiveOutputDelayMs(_cwd?: string): number {
  return Math.max(0, Math.floor(toolRendererSettings.bashLiveOutputDelayMs));
}

export function bashLiveTailLines(_cwd?: string): number {
  return Math.max(1, Math.floor(toolRendererSettings.bashLiveTailLines));
}

export function mcpOutputMode(_cwd?: string): McpOutputMode {
  return toolRendererSettings.mcpOutputMode;
}

export type TreeStyle = "unicode" | "ascii";

export function treeStyle(_cwd?: string): TreeStyle {
  return toolRendererSettings.treeStyle;
}

export function pendingStatusAnimation(_cwd?: string): boolean {
  return toolRendererSettings.pendingStatusAnimation;
}

export function diffBackgroundEnabled(_cwd?: string): boolean {
  return toolRendererSettings.diffBackgrounds;
}

export function bashDiffRenderingEnabled(_cwd?: string): boolean {
  return toolRendererSettings.renderBashDiffs;
}

export type ToolChromeMode = "off" | "transparent" | "outlines";

export function toolChromeMode(_cwd?: string): ToolChromeMode {
  return toolRendererSettings.toolChrome;
}
