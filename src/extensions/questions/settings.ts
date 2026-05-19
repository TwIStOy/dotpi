/**
 * Static configuration for the questions extension (not read from settings.json).
 * Change behavior by editing this file only.
 */
export const questionsSettings = {
  /** Where interactive questions render: `editor` replaces the input area; `overlay` uses a centered popup. */
  renderMode: "editor" as "editor" | "overlay",

  /** Maximum option rows shown before scrolling (overlay pads; editor clamps to list height). */
  optionRows: 10,

  /** Fallback title when a question request has no header. */
  defaultHeader: "Question",

  /** Allow bridge-style callers to answer or reject pending questions. */
  bridgeRepliesEnabled: true,

  /** Overlay popup width in terminal columns when `renderMode` is `overlay`. */
  popupWidth: 96,

  /** Overlay max height (`number` = lines, or percentage string). */
  popupMaxHeight: "80%" as const,
} as const;
