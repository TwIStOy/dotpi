import {
  ToolExecutionComponent,
  type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { Container, Loader } from "@earendil-works/pi-tui";

import {
  stableRenderWidth,
  stripAnsi,
  stripLeadingBackgroundLayer,
  trimOuterBlankLines,
  trimTrailingWhitespaceBeforeAnsi,
  wrapTextWithAnsi,
} from "./ansi.js";
import { captureDiffBackgroundTheme } from "./diff.js";
import {
  renderApplyPatchCall,
  renderApplyPatchResult,
  renderGenericToolCall,
  renderGenericToolResult,
  renderUnknownToolCall,
  renderUnknownToolResult,
  shouldUseGenericRenderer,
  shouldUseUnknownToolRenderer,
  componentDefinesRenderer,
} from "./generic.js";
import { toolChromeMode, toolRendererSettings } from "./settings.js";
import { subtleRule } from "./theme.js";

const TOOL_EXECUTION_RENDERER_PATCH_SYMBOL = Symbol.for(
  "dotpi.tool-renderer.tool-execution-renderer-patch.v2",
);
const TOOL_CHROME_PATCH_SYMBOL = Symbol.for(
  "dotpi.tool-renderer.tool-chrome-patch",
);
const TOOL_CHROME_THEME_SYMBOL = Symbol.for(
  "dotpi.tool-renderer.tool-chrome-theme",
);
const WORKING_LOADER_ALIGNMENT_PATCH_SYMBOL = Symbol.for(
  "dotpi.tool-renderer.working-loader-alignment-patch",
);

export function rememberToolChromeTheme(component: any, theme: any): void {
  if (theme?.fg) component[TOOL_CHROME_THEME_SYMBOL] = theme;
}

export function withCallTheme(
  component: any,
  renderer: (args: any, theme: any, context: any) => any,
): (args: any, theme: any, context: any) => any {
  return function renderCallWithRememberedTheme(
    this: any,
    args: any,
    theme: any,
    context: any,
  ) {
    rememberToolChromeTheme(component, theme);
    return renderer.call(this, args, theme, context);
  };
}

export function withResultTheme(
  component: any,
  renderer: (result: any, options: any, theme: any, context: any) => any,
): (result: any, options: any, theme: any, context: any) => any {
  return function renderResultWithRememberedTheme(
    this: any,
    result: any,
    options: any,
    theme: any,
    context: any,
  ) {
    rememberToolChromeTheme(component, theme);
    return renderer.call(this, result, options, theme, context);
  };
}

export function installToolExecutionRendererPatch(pi: ExtensionAPI): void {
  const proto = ToolExecutionComponent?.prototype as any;
  if (!proto) return;
  const existing = proto[TOOL_EXECUTION_RENDERER_PATCH_SYMBOL] as
    | {
        originalGetCallRenderer?: unknown;
        originalGetRenderShell?: unknown;
        originalGetResultRenderer?: unknown;
        originalHasRendererDefinition?: unknown;
        originalRender?: unknown;
      }
    | undefined;
  const originalGetCallRenderer =
    existing?.originalGetCallRenderer ?? proto.getCallRenderer;
  const originalGetResultRenderer =
    existing?.originalGetResultRenderer ?? proto.getResultRenderer;
  const originalHasRendererDefinition =
    existing?.originalHasRendererDefinition ?? proto.hasRendererDefinition;
  const originalGetRenderShell =
    existing?.originalGetRenderShell ?? proto.getRenderShell;
  const originalRender = existing?.originalRender ?? proto.render;
  if (
    typeof originalGetCallRenderer !== "function" ||
    typeof originalGetResultRenderer !== "function" ||
    typeof originalHasRendererDefinition !== "function" ||
    typeof originalGetRenderShell !== "function" ||
    typeof originalRender !== "function"
  )
    return;
  const state = {
    originalGetCallRenderer,
    originalGetRenderShell,
    originalGetResultRenderer,
    originalHasRendererDefinition,
    originalRender,
  };
  proto.render = function patchedToolExecutionRender(
    this: any,
    width: number,
  ): string[] {
    const rendered = originalRender.call(this, width);
    if (
      !Array.isArray(rendered) ||
      typeof this?.toolName !== "string" ||
      typeof this?.toolCallId !== "string"
    )
      return rendered;
    return trimOuterBlankLines(rendered);
  };
  proto.hasRendererDefinition = function patchedHasRendererDefinition(
    this: any,
  ) {
    const toolName = typeof this?.toolName === "string" ? this.toolName : "";
    if (shouldUseUnknownToolRenderer(this, toolName)) return true;
    return originalHasRendererDefinition.call(this);
  };
  proto.getRenderShell = function patchedGetRenderShell(this: any) {
    const toolName = typeof this?.toolName === "string" ? this.toolName : "";
    if (shouldUseUnknownToolRenderer(this, toolName)) return "self";
    return originalGetRenderShell.call(this);
  };
  proto.getCallRenderer = function patchedGetCallRenderer(this: any) {
    const toolName = typeof this?.toolName === "string" ? this.toolName : "";
    if (shouldUseUnknownToolRenderer(this, toolName)) {
      return withCallTheme(this, (args: any, theme: any, context: any) =>
        renderUnknownToolCall(toolName, args, theme, context),
      );
    }
    if (
      toolName === "apply_patch" &&
      toolRendererSettings.applyPatchRenderer &&
      !componentDefinesRenderer(this, "renderCall")
    ) {
      return withCallTheme(this, (args: any, theme: any, context: any) =>
        renderApplyPatchCall(args, theme, context),
      );
    }
    if (
      toolRendererSettings.genericToolRenderers &&
      shouldUseGenericRenderer(toolName) &&
      !componentDefinesRenderer(this, "renderCall")
    ) {
      return withCallTheme(this, (args: any, theme: any, context: any) =>
        renderGenericToolCall(toolName, args, theme, context),
      );
    }
    const renderer = originalGetCallRenderer.call(this);
    return typeof renderer === "function"
      ? withCallTheme(this, renderer)
      : renderer;
  };
  proto.getResultRenderer = function patchedGetResultRenderer(this: any) {
    const toolName = typeof this?.toolName === "string" ? this.toolName : "";
    if (shouldUseUnknownToolRenderer(this, toolName)) {
      return withResultTheme(
        this,
        (result: any, options: any, theme: any, context: any) =>
          renderUnknownToolResult(toolName, result, options, theme, context),
      );
    }
    if (
      toolName === "apply_patch" &&
      toolRendererSettings.applyPatchRenderer &&
      !componentDefinesRenderer(this, "renderResult")
    ) {
      return withResultTheme(
        this,
        (result: any, options: any, theme: any, context: any) =>
          renderApplyPatchResult(result, options, theme, context),
      );
    }
    if (
      toolRendererSettings.genericToolRenderers &&
      shouldUseGenericRenderer(toolName) &&
      !componentDefinesRenderer(this, "renderResult")
    ) {
      return withResultTheme(
        this,
        (result: any, options: any, theme: any, context: any) =>
          renderGenericToolResult(toolName, result, options, theme, context),
      );
    }
    const renderer = originalGetResultRenderer.call(this);
    return typeof renderer === "function"
      ? withResultTheme(this, renderer)
      : renderer;
  };
  proto[TOOL_EXECUTION_RENDERER_PATCH_SYMBOL] = state;
  pi.on("session_shutdown", () => {
    if (proto[TOOL_EXECUTION_RENDERER_PATCH_SYMBOL] !== state) return;
    proto.render = originalRender;
    proto.hasRendererDefinition = originalHasRendererDefinition;
    proto.getRenderShell = originalGetRenderShell;
    proto.getCallRenderer = originalGetCallRenderer;
    proto.getResultRenderer = originalGetResultRenderer;
    delete proto[TOOL_EXECUTION_RENDERER_PATCH_SYMBOL];
  });
}

function prepareToolChromeTheme(theme: any): void {
  if (toolChromeMode() === "off") return;
  captureDiffBackgroundTheme(theme);
}

let activeToolChromeTheme: unknown;

function mutedHorizontalRule(theme: any, width: number): string {
  return subtleRule(theme, "─".repeat(stableRenderWidth(width)));
}

function shouldOmitBottomToolChromeRule(core: string[]): boolean {
  return core.some((line) => /└─+(?:┴─+)?┘/.test(stripAnsi(line ?? "")));
}

export function installToolChromePatch(): void {
  const proto = Container?.prototype as any;
  if (!proto || proto[TOOL_CHROME_PATCH_SYMBOL]) return;
  const originalRender = proto.render;
  if (typeof originalRender !== "function") return;
  proto.render = function patchedToolChromeRender(
    this: any,
    width: number,
  ): string[] {
    const rendered = originalRender.call(this, width);
    if (!Array.isArray(rendered) || rendered.length === 0) return rendered;
    if (
      typeof this?.toolName !== "string" ||
      typeof this?.toolCallId !== "string"
    )
      return rendered;
    const mode = toolChromeMode();
    if (mode === "off") return rendered;
    let start = 0;
    while (
      start < rendered.length &&
      stripAnsi(rendered[start] ?? "").trim().length === 0
    )
      start++;
    let end = rendered.length - 1;
    while (end >= start && stripAnsi(rendered[end] ?? "").trim().length === 0)
      end--;
    if (start > end) return rendered;
    const renderWidth = stableRenderWidth(width);
    const core = rendered.slice(start, end + 1).flatMap((line) => {
      // Pi's Text/Box components pad rows before trailing SGR reset codes.
      // Plain trimEnd() cannot see those spaces when ANSI comes after them;
      // if they survive, the right-margin guard wraps each padded row into a
      // blank continuation line. Trim visually trailing spaces before wrapping.
      const wrapped = wrapTextWithAnsi(
        trimTrailingWhitespaceBeforeAnsi(stripLeadingBackgroundLayer(line)),
        renderWidth,
      );
      return wrapped.length > 0 ? wrapped : [""];
    });
    if (mode === "transparent") return core;
    const activeTheme =
      this?.[TOOL_CHROME_THEME_SYMBOL] ??
      this?.ui?.theme ??
      (activeToolChromeTheme as { fg?: (t: string, s: string) => string } | undefined);
    const rule = mutedHorizontalRule(activeTheme, width);
    return shouldOmitBottomToolChromeRule(core)
      ? [rule, ...core]
      : [rule, ...core, rule];
  };
  proto[TOOL_CHROME_PATCH_SYMBOL] = true;
}

export function registerToolChromeEvents(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    activeToolChromeTheme = ctx.hasUI ? ctx.ui.theme : undefined;
    if (ctx.hasUI) prepareToolChromeTheme(ctx.ui.theme);
  });
  pi.on("turn_start", (_event, ctx) => {
    activeToolChromeTheme = ctx.hasUI ? ctx.ui.theme : undefined;
    if (ctx.hasUI) prepareToolChromeTheme(ctx.ui.theme);
  });
  pi.on("session_shutdown", () => {
    activeToolChromeTheme = undefined;
  });
}

export function installWorkingIndicator(pi: ExtensionAPI): void {
  pi.on("session_start", (_event, ctx) => {
    if (!ctx.hasUI) return;
    const mode = toolRendererSettings.workingIndicator;
    if (mode === "default") return;
    if (mode === "hidden") {
      ctx.ui.setWorkingIndicator({ frames: [] });
      return;
    }
    ctx.ui.setWorkingIndicator({
      frames: [
        ctx.ui.theme.fg("dim", "·"),
        ctx.ui.theme.fg("muted", "•"),
        ctx.ui.theme.fg("accent", "●"),
        ctx.ui.theme.fg("muted", "•"),
      ],
      intervalMs: 120,
    });
  });
  pi.on("session_shutdown", (_event, ctx) => {
    if (ctx.hasUI) ctx.ui.setWorkingIndicator();
  });
}

export function installWorkingLoaderAlignmentPatch(): void {
  const proto = Loader.prototype as unknown as Record<PropertyKey, any>;
  if (proto[WORKING_LOADER_ALIGNMENT_PATCH_SYMBOL]) return;
  const originalRender = proto.render;
  if (typeof originalRender !== "function") return;
  proto[WORKING_LOADER_ALIGNMENT_PATCH_SYMBOL] = true;
  proto.render = function patchedWorkingLoaderRender(
    this: any,
    width: number,
  ): string[] {
    const message = typeof this?.message === "string" ? this.message : "";
    if (!message.startsWith("Working..."))
      return originalRender.call(this, width);
    const originalPaddingX = this.paddingX;
    try {
      this.paddingX = 0;
      this.invalidate?.();
      return originalRender.call(this, width);
    } finally {
      this.paddingX = originalPaddingX;
      this.invalidate?.();
    }
  };
}
