type RenderComponent = { invalidate(): void; render(width: number): string[] };

const emptyComponent: RenderComponent = {
  invalidate() {},
  render() {
    return [];
  },
};

function lines(text: string): RenderComponent {
  return {
    invalidate() {},
    render() {
      return text.split(/\r?\n/);
    },
  };
}

function resultRaw(result: any): string {
  return result?.content?.find?.((c: any) => c?.type === "text")?.text ?? "";
}

function buildCallLine(theme: any, toolName: string, uri: string, suffix?: string): string {
  let line = `${theme.fg("accent", "● ")}${theme.fg("text", theme.bold(`${toolName} `))}${theme.fg("accent", uri)}`;
  if (suffix) line += theme.fg("dim", suffix);
  return line;
}

export function renderCall(
  theme: any,
  context: any,
  toolName: string,
  uri: string,
  suffix?: string,
): RenderComponent {
  if (!context?.executionStarted || !context?.isPartial) return emptyComponent;
  return lines(
    `${theme.fg("warning", "● ")}${theme.fg("text", theme.bold(`${toolName} `))}${theme.fg("accent", uri)}${suffix ? theme.fg("dim", suffix) : ""}`,
  );
}

export function renderResultPending(
  call: string,
  theme: any,
  verb: string,
): RenderComponent {
  return lines(`${call}${theme.fg("dim", ` · ${verb}…`)}`);
}

export function renderResultError(
  call: string,
  theme: any,
  result: any,
  fallback: string,
): RenderComponent {
  const errLine = resultRaw(result).split(/\r?\n/)[0] || fallback;
  return lines(`${call}${theme.fg("dim", " · ")}${theme.fg("error", errLine)}`);
}

export { buildCallLine, emptyComponent, lines, resultRaw };
