import {
  getMarkdownTheme,
  keyText,
  type ExtensionAPI,
  type ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { Markdown, Text } from "@earendil-works/pi-tui";

import {
  ansiGreen,
  ansiPartsFromStyled,
  ansiRed,
  isThinkingOnlyAssistantMessage,
  padVisible,
  stableRenderWidth,
  stripAnsi,
  truncateAnsi,
  trimOuterBlankLinesAroundRules,
  trimThinkingOnlyAssistantLines,
  trimTrailingBlankLines,
  visibleWidth,
  wrapTextWithAnsi,
} from "./ansi.js";
import { toolRendererSettings } from "./settings.js";
import {
  FALLBACK_THEME,
  stackPrefix,
  toolLabel,
  treeConnector,
} from "./theme.js";
import { makeTruncatedLines } from "./text.js";

const USER_MESSAGE_PATCH_SYMBOL = Symbol.for(
  "dotpi.tool-renderer.user-message-patch",
);
const USER_MESSAGE_BOX_STATE_SYMBOL = Symbol.for(
  "dotpi.tool-renderer.user-message-box-state",
);
const ASSISTANT_MESSAGE_PATCH_SYMBOL = Symbol.for(
  "dotpi.tool-renderer.assistant-message-patch",
);
const CUSTOM_MESSAGE_SPACING_PATCH_SYMBOL = Symbol.for(
  "dotpi.tool-renderer.custom-message-spacing-patch",
);
const COMPACTION_SUMMARY_RENDERER_PATCH_SYMBOL = Symbol.for(
  "dotpi.tool-renderer.compaction-summary-renderer-patch",
);
const SKILL_INVOCATION_RENDERER_PATCH_SYMBOL = Symbol.for(
  "dotpi.tool-renderer.skill-invocation-renderer-patch",
);
const MARKDOWN_CODE_BLOCK_PATCH_SYMBOL = Symbol.for(
  "dotpi.tool-renderer.markdown-code-block-patch",
);

function renderUserMessageBorder(lines: string[], width: number): string[] {
  if (lines.length === 0 || width < 4) return lines;
  const innerWidth = Math.max(1, width - 2);
  const border = (text: string) => ansiGreen(text);
  const marker = (text: string) => ansiRed(text);
  const topBorder = () => {
    if (innerWidth < 5) return border("━".repeat(innerWidth));
    const left = "━ ";
    const right = ` ${"━".repeat(Math.max(0, innerWidth - visibleWidth(left) - 2))}`;
    return `${border(left)}${marker("π")}${border(right)}`;
  };
  const fitLine = (line: string) => {
    const clean = stripAnsi(line);
    return padVisible(truncateAnsi(clean, innerWidth), innerWidth);
  };

  return [
    `${border("┏")}${topBorder()}${border("┓")}`,
    ...lines.map((line) => `${border("┃")}${fitLine(line)}${border("┃")}`),
    `${border("┗")}${border("━".repeat(innerWidth))}${border("┛")}`,
  ];
}

function appendUserMessageBreak(lines: string[]): string[] {
  if (lines.length === 0 || !toolRendererSettings.userMessageTrailingBlankLine)
    return lines;
  // A visual blank row does not need to fill the terminal width. Keeping it empty
  // avoids writing a printable character into the last column, which can trigger
  // auto-wrap/scroll flashes in tmux and some terminal emulators when streaming
  // output is already sitting on the bottom row.
  return [...lines, ""];
}

interface UserMessagePatchState {
  /** Snapshot from session_start; never read ctx.hasUI / ctx.ui from a cached ExtensionContext in render (stale after reload / session replace). */
  interactiveUI: boolean;
  uiTheme?: unknown;
  originalRender: (width: number) => string[];
}

export function installUserMessageRenderer(
  pi: ExtensionAPI,
  UserMessageComponent: any,
): void {
  const prototype = UserMessageComponent?.prototype as
    | Record<PropertyKey, unknown>
    | undefined;
  if (!prototype || typeof prototype.render !== "function") return;

  let state = prototype[USER_MESSAGE_PATCH_SYMBOL] as
    | UserMessagePatchState
    | undefined;
  if (!state) {
    state = {
      interactiveUI: false,
      originalRender: prototype.render as (width: number) => string[],
    };
    prototype[USER_MESSAGE_PATCH_SYMBOL] = state;
    prototype.render = function compactUserMessageRender(
      this: any,
      width: number,
    ): string[] {
      const box = this?.contentBox;
      if (box && state?.interactiveUI) {
        const compact = toolRendererSettings.compactUserMessages;
        const paddingY = compact ? 0 : 1;
        const boxState = compact
          ? `${paddingY}:border:ansi-green:text:pi-red:left`
          : `${paddingY}:background:userMessageBg`;

        if (box[USER_MESSAGE_BOX_STATE_SYMBOL] !== boxState) {
          box.paddingY = paddingY;
          if (compact) {
            box.setBgFn?.(undefined);
          } else {
            box.setBgFn?.((content: string) => {
              const theme = state?.uiTheme as { bg?: (key: string, s: string) => string } | undefined;
              if (!theme?.bg) return content;
              try {
                return theme.bg("userMessageBg", content);
              } catch {
                return theme.bg("userMessageBg", content);
              }
            });
          }
          box.invalidateCache?.();
          box[USER_MESSAGE_BOX_STATE_SYMBOL] = boxState;
        }

        if (compact && width >= 4) {
          const frameWidth = stableRenderWidth(width);
          const raw = state!.originalRender.call(
            this,
            Math.max(1, frameWidth - 2),
          );
          const lines = Array.isArray(raw)
            ? raw.flatMap((l: string) => l.split(/\r?\n/))
            : [];
          return appendUserMessageBreak(
            renderUserMessageBorder(lines, frameWidth),
          );
        }
      }

      return appendUserMessageBreak(state!.originalRender.call(this, width));
    };
  }

  pi.on("session_start", (_event: any, ctx: ExtensionContext) => {
    state!.interactiveUI = ctx.hasUI;
    state!.uiTheme = ctx.hasUI ? ctx.ui.theme : undefined;
  });
  pi.on("session_shutdown", () => {
    if (prototype[USER_MESSAGE_PATCH_SYMBOL] === state) {
      prototype.render = state!.originalRender as unknown;
      delete prototype[USER_MESSAGE_PATCH_SYMBOL];
    }
    state!.interactiveUI = false;
    state!.uiTheme = undefined;
  });
}

interface AssistantMessagePatchState {
  originalRender: (width: number) => string[];
  originalUpdateContent: (message: any) => void;
}

function alignAssistantContent(component: any): void {
  const children = component?.contentContainer?.children;
  if (!Array.isArray(children)) return;
  for (const child of children) {
    if (child instanceof Markdown || child instanceof Text) {
      (child as any).paddingX = 0;
      (child as any).invalidate?.();
    }
  }
}

export function installAssistantMessageRenderer(
  pi: ExtensionAPI,
  AssistantMessageComponent: any,
): void {
  const prototype = AssistantMessageComponent?.prototype as
    | Record<PropertyKey, unknown>
    | undefined;
  if (
    !prototype ||
    typeof prototype.render !== "function" ||
    typeof prototype.updateContent !== "function"
  )
    return;

  let state = prototype[ASSISTANT_MESSAGE_PATCH_SYMBOL] as
    | AssistantMessagePatchState
    | undefined;
  if (!state) {
    state = {
      originalRender: prototype.render as (width: number) => string[],
      originalUpdateContent: prototype.updateContent as (message: any) => void,
    };
    prototype[ASSISTANT_MESSAGE_PATCH_SYMBOL] = state;
    prototype.render = function spacedAssistantRender(
      this: any,
      width: number,
    ): string[] {
      const rendered = state!.originalRender.call(this, width);
      if (!Array.isArray(rendered) || rendered.length === 0) return rendered;
      if (isThinkingOnlyAssistantMessage(this?.lastMessage))
        return trimThinkingOnlyAssistantLines(rendered);
      if (this?.hasToolCalls) return rendered;
      const end = trimTrailingBlankLines(rendered);
      if (end.length === 0) return rendered;
      return [...end, ""];
    };
    prototype.updateContent = function alignedAssistantUpdateContent(
      this: any,
      message: any,
    ): void {
      state!.originalUpdateContent.call(this, message);
      if (toolRendererSettings.alignAssistantMessages)
        alignAssistantContent(this);
    };
  }

  pi.on("session_shutdown", () => {
    if (prototype[ASSISTANT_MESSAGE_PATCH_SYMBOL] === state) {
      prototype.render = state!.originalRender as unknown;
      prototype.updateContent = state!.originalUpdateContent as unknown;
      delete prototype[ASSISTANT_MESSAGE_PATCH_SYMBOL];
    }
  });
}

interface CompactionSummaryPatchState {
  uiTheme?: unknown;
  originalUpdateDisplay: () => void;
}

export function installCompactionSummaryRenderer(
  pi: ExtensionAPI,
  Component: any,
): void {
  const prototype = Component?.prototype as
    | Record<PropertyKey, unknown>
    | undefined;
  if (!prototype || typeof prototype.updateDisplay !== "function") return;

  let state = prototype[COMPACTION_SUMMARY_RENDERER_PATCH_SYMBOL] as
    | CompactionSummaryPatchState
    | undefined;
  if (!state) {
    state = {
      originalUpdateDisplay: prototype.updateDisplay as () => void,
    };
    prototype[COMPACTION_SUMMARY_RENDERER_PATCH_SYMBOL] = state;
    prototype.updateDisplay = function compactCompactionSummaryDisplay(
      this: any,
    ): void {
      if (!toolRendererSettings.compactCompactionMessages) {
        state!.originalUpdateDisplay.call(this);
        return;
      }

      const theme = (state?.uiTheme as any) ?? FALLBACK_THEME;
      const message = this?.message ?? {};
      const tokensBefore = Number.isFinite(Number(message.tokensBefore))
        ? Number(message.tokensBefore)
        : 0;
      const tokenStr = tokensBefore.toLocaleString();
      const expanded = Boolean(this?.expanded);
      const summary =
        typeof message.summary === "string" && message.summary.trim()
          ? message.summary.trim()
          : "No summary was recorded.";

      this.paddingX = 0;
      this.paddingY = 0;
      this.setBgFn?.(undefined);
      this.clear?.();

      const hint = expanded ? "" : theme.fg("dim", " · ctrl+o to expand");
      this.addChild?.(
        makeTruncatedLines(
          `${stackPrefix(theme)}${toolLabel(theme, "Compacted ")}${theme.fg("success", `${tokenStr} tokens`)}${hint}`,
        ),
      );

      if (expanded) {
        this.addChild?.(
          makeTruncatedLines(
            `${treeConnector(theme, "└")}${theme.fg("muted", "Summary")}`,
          ),
        );
        this.addChild?.(
          new Markdown(
            summary,
            0,
            0,
            this?.markdownTheme ?? getMarkdownTheme(),
            {
              color: (text: string) => theme.fg("customMessageText", text),
            },
          ),
        );
      }
    };
  }

  pi.on("session_start", (_event: any, ctx: ExtensionContext) => {
    state!.uiTheme = ctx.hasUI ? ctx.ui.theme : undefined;
  });
  pi.on("session_shutdown", () => {
    if (prototype[COMPACTION_SUMMARY_RENDERER_PATCH_SYMBOL] === state) {
      prototype.updateDisplay = state!.originalUpdateDisplay as unknown;
      delete prototype[COMPACTION_SUMMARY_RENDERER_PATCH_SYMBOL];
    }
    state!.uiTheme = undefined;
  });
}

interface SkillInvocationPatchState {
  uiTheme?: unknown;
  originalUpdateDisplay: () => void;
}

interface CustomMessageSpacingPatchState {
  originalRender: (width: number) => string[];
}

export function installCustomMessageSpacingPatch(
  pi: ExtensionAPI,
  CustomMessageComponent: any,
): void {
  const prototype = CustomMessageComponent?.prototype as
    | Record<PropertyKey, unknown>
    | undefined;
  if (!prototype || typeof prototype.render !== "function") return;

  let state = prototype[CUSTOM_MESSAGE_SPACING_PATCH_SYMBOL] as
    | CustomMessageSpacingPatchState
    | undefined;
  if (!state) {
    state = { originalRender: prototype.render as (width: number) => string[] };
    prototype[CUSTOM_MESSAGE_SPACING_PATCH_SYMBOL] = state;
    prototype.render = function compactRuledCustomMessageRender(
      this: any,
      width: number,
    ): string[] {
      const rendered = state!.originalRender.call(this, width);
      if (!Array.isArray(rendered) || rendered.length === 0) return rendered;
      return trimOuterBlankLinesAroundRules(rendered);
    };
  }

  pi.on("session_shutdown", () => {
    if (prototype[CUSTOM_MESSAGE_SPACING_PATCH_SYMBOL] === state) {
      prototype.render = state!.originalRender as unknown;
      delete prototype[CUSTOM_MESSAGE_SPACING_PATCH_SYMBOL];
    }
  });
}

export function installSkillInvocationRenderer(
  pi: ExtensionAPI,
  Component: any,
): void {
  const prototype = Component?.prototype as
    | Record<PropertyKey, unknown>
    | undefined;
  if (!prototype || typeof prototype.updateDisplay !== "function") return;

  let state = prototype[SKILL_INVOCATION_RENDERER_PATCH_SYMBOL] as
    | SkillInvocationPatchState
    | undefined;
  if (!state) {
    state = {
      originalUpdateDisplay: prototype.updateDisplay as () => void,
    };
    prototype[SKILL_INVOCATION_RENDERER_PATCH_SYMBOL] = state;
    prototype.updateDisplay = function compactSkillInvocationDisplay(
      this: any,
    ): void {
      if (!toolRendererSettings.compactSkillMessages) {
        state!.originalUpdateDisplay.call(this);
        return;
      }

      const th = (state?.uiTheme as any) ?? FALLBACK_THEME;
      const skillBlock = this?.skillBlock ?? {};
      const name =
        typeof skillBlock.name === "string" && skillBlock.name.trim()
          ? skillBlock.name.trim()
          : "skill";
      const content =
        typeof skillBlock.content === "string" ? skillBlock.content : "";
      const expanded = Boolean(this?.expanded);

      this.paddingX = 0;
      this.paddingY = 0;
      this.setBgFn?.(undefined);
      this.clear?.();

      const hint = expanded
        ? ""
        : th.fg("dim", ` · ${keyText("app.tools.expand")} expand`);
      this.addChild?.(
        makeTruncatedLines(
          `${stackPrefix(th)}${toolLabel(th, "Skill ")}${th.fg("accent", name)}${hint}`,
        ),
      );

      if (expanded) {
        this.addChild?.(
          makeTruncatedLines(
            `${treeConnector(th, "└")}${th.fg("muted", "Content")}`,
          ),
        );
        this.addChild?.(
          new Markdown(
            `**${name}**\n\n${content}`,
            0,
            0,
            this?.markdownTheme ?? getMarkdownTheme(),
            {
              color: (text: string) => th.fg("customMessageText", text),
            },
          ),
        );
      }
    };
  }

  pi.on("session_start", (_event: any, ctx: ExtensionContext) => {
    state!.uiTheme = ctx.hasUI ? ctx.ui.theme : undefined;
  });
  pi.on("session_shutdown", () => {
    if (prototype[SKILL_INVOCATION_RENDERER_PATCH_SYMBOL] === state) {
      prototype.updateDisplay = state!.originalUpdateDisplay as unknown;
      delete prototype[SKILL_INVOCATION_RENDERER_PATCH_SYMBOL];
    }
    state!.uiTheme = undefined;
  });
}

interface MarkdownCodeBlockPatchState {
  uiTheme?: unknown;
  originalRenderToken: (
    token: any,
    width: number,
    nextTokenType?: string,
    styleContext?: unknown,
  ) => string[];
}

function codeBlockBgParts(uiTheme?: unknown): {
  open: string;
  close: string;
} {
  const marker = "\uE000";
  try {
    const theme = uiTheme as { bg?: (key: string, s: string) => string } | undefined;
    if (theme?.bg)
      return ansiPartsFromStyled(theme.bg("customMessageBg", marker));
  } catch {
    // Fall through to a neutral dark background.
  }
  return { open: "\x1b[48;5;236m", close: "\x1b[49m" };
}

function applyCodeBlockBg(line: string, uiTheme?: unknown): string {
  const { open, close } = codeBlockBgParts(uiTheme);
  if (!open) return line;
  const reapplied = line.replace(
    /\x1b\[(?:0|49)m/g,
    (reset) => `${reset}${open}`,
  );
  return `${open}${reapplied}${close}`;
}

function padAnsiLine(line: string, width: number): string {
  return `${line}${" ".repeat(Math.max(0, width - visibleWidth(line)))}`;
}

function renderStyledCodeBlock(
  token: any,
  width: number,
  markdownTheme: any,
  uiTheme?: unknown,
): string[] {
  const contentWidth = stableRenderWidth(width);
  const rawLang = typeof token?.lang === "string" ? token.lang.trim() : "";
  const lang = rawLang.split(/\s+/)[0] || undefined;
  const code = typeof token?.text === "string" ? token.text : "";

  if (contentWidth < 8) {
    return code
      .split("\n")
      .map((line: string) =>
        markdownTheme?.codeBlock ? markdownTheme.codeBlock(line) : line,
      );
  }

  const blockIndent = "  ";
  const panelWidth = Math.max(1, contentWidth - visibleWidth(blockIndent));

  let highlightedLines: string[];
  try {
    highlightedLines = markdownTheme?.highlightCode
      ? markdownTheme.highlightCode(code, lang)
      : code
          .split("\n")
          .map((line: string) =>
            markdownTheme?.codeBlock ? markdownTheme.codeBlock(line) : line,
          );
  } catch {
    highlightedLines = code
      .split("\n")
      .map((line: string) =>
        markdownTheme?.codeBlock ? markdownTheme.codeBlock(line) : line,
      );
  }

  const strip = markdownTheme?.codeBlockBorder
    ? markdownTheme.codeBlockBorder("▌")
    : "▌";
  const stripWidth = Math.max(1, visibleWidth(strip));
  const bodyWidth = Math.max(1, panelWidth - stripWidth);
  const codeWidth = Math.max(1, bodyWidth - 2);
  const lines: string[] = [];
  const blankBody = applyCodeBlockBg(" ".repeat(bodyWidth), uiTheme);
  lines.push(`${blockIndent}${strip}${blankBody}`);
  for (const highlightedLine of highlightedLines) {
    const wrapped = wrapTextWithAnsi(highlightedLine, codeWidth);
    const segments = wrapped.length > 0 ? wrapped : [""];
    for (const segment of segments) {
      const paddedCode = padAnsiLine(segment, codeWidth);
      lines.push(
        `${blockIndent}${strip}${applyCodeBlockBg(` ${paddedCode} `, uiTheme)}`,
      );
    }
  }
  lines.push(`${blockIndent}${strip}${blankBody}`);
  return lines;
}

export function installMarkdownCodeBlockRenderer(pi: ExtensionAPI): void {
  const prototype = (Markdown as any)?.prototype as
    | Record<PropertyKey, unknown>
    | undefined;
  if (!prototype || typeof prototype.renderToken !== "function") return;

  let state = prototype[MARKDOWN_CODE_BLOCK_PATCH_SYMBOL] as
    | MarkdownCodeBlockPatchState
    | undefined;
  if (!state) {
    state = {
      originalRenderToken:
        prototype.renderToken as MarkdownCodeBlockPatchState["originalRenderToken"],
    };
    prototype[MARKDOWN_CODE_BLOCK_PATCH_SYMBOL] = state;
    prototype.renderToken = function styledCodeBlockRenderToken(
      this: any,
      token: any,
      width: number,
      nextTokenType?: string,
      styleContext?: unknown,
    ): string[] {
      if (token?.type === "code" && toolRendererSettings.styledCodeBlocks) {
        const codeLines = renderStyledCodeBlock(
          token,
          width,
          this?.theme,
          state?.uiTheme,
        );
        if (nextTokenType && nextTokenType !== "space")
          return [...codeLines, ""];
        return codeLines;
      }
      return state!.originalRenderToken.call(
        this,
        token,
        width,
        nextTokenType,
        styleContext,
      );
    };
  }

  pi.on("session_start", (_event: any, ctx: ExtensionContext) => {
    state!.uiTheme = ctx.hasUI ? ctx.ui.theme : undefined;
  });
  pi.on("session_shutdown", () => {
    if (prototype[MARKDOWN_CODE_BLOCK_PATCH_SYMBOL] === state) {
      prototype.renderToken = state!.originalRenderToken as unknown;
      delete prototype[MARKDOWN_CODE_BLOCK_PATCH_SYMBOL];
    }
    state!.uiTheme = undefined;
  });
}
