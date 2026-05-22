import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runHat } from "../cli-runner.js";
import { jsonError, jsonResult } from "../tool-result.js";
import {
  buildCallLine,
  lines,
  renderCall,
  renderResultError,
  renderResultPending,
  resultRaw,
} from "./render.js";

interface ListNode {
  uri: string;
  domain: string;
  path: string;
  priority: number;
  disclosure: string;
  content_length: number;
  children: ListNode[];
}

function parseListResult(result: any): ListNode[] {
  const raw = resultRaw(result);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    const nodes = parsed?.nodes;
    if (!Array.isArray(nodes)) return [];
    return nodes as ListNode[];
  } catch {
    return [];
  }
}

function formatNodeRow(node: ListNode, theme: any): string {
  let line = `${theme.fg("accent", node.uri)}`;
  const meta: string[] = [];
  if (node.priority !== 5 && node.priority !== undefined)
    meta.push(`p${node.priority}`);
  if (node.disclosure) meta.push(node.disclosure);
  if (node.content_length > 0) meta.push(`${node.content_length} chars`);
  if (meta.length > 0)
    line += ` ${theme.fg("dim", `· ${meta.join(" · ")}`)}`;
  return line;
}

function countNodes(nodes: ListNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count++;
    if (node.children?.length) count += countNodes(node.children);
  }
  return count;
}

function renderNodeTree(
  nodes: ListNode[],
  theme: any,
  prefix: string,
  isLast: boolean[],
): string[] {
  const out: string[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const last = i === nodes.length - 1;
    const branch = last ? "└─ " : "├─ ";
    const indent = isLast.map((l) => (l ? "   " : "│  ")).join("");
    out.push(`${theme.fg("muted", `${indent}${branch}`)}${formatNodeRow(node, theme)}`);
    if (node.children?.length) {
      out.push(...renderNodeTree(node.children, theme, prefix, [...isLast, last]));
    }
  }
  return out;
}

export const memoryList = defineTool({
  name: "memory-list",
  label: "Memory list",
  description:
    "List all memory nodes as a tree structure. Optionally filter by domain.",
  parameters: Type.Object({
    domain: Type.Optional(
      Type.String({
        description: "List only nodes in this domain (e.g. 'core', 'notes').",
      }),
    ),
  }),
  execute: async (_id, args) => {
    try {
      const cliArgs = ["memory", "list"];
      if (args.domain) cliArgs.push(args.domain);
      const result = await runHat(cliArgs);
      return jsonResult(result);
    } catch (e) {
      return jsonError(e);
    }
  },
  renderCall(args: any, theme: any, context: any) {
    const domain = args?.domain ?? "";
    return renderCall(theme, context, "Memory list", domain || "(all)");
  },
  renderResult(result: any, opts: any, theme: any, context: any) {
    const expanded = opts?.expanded;
    const isPartial = opts?.isPartial;
    const errored = Boolean(context?.isError || result?.isError);
    const domain = context?.args?.domain ?? "";
    const call = buildCallLine(theme, "Memory list", domain || "(all)");

    if (isPartial) return renderResultPending(call, theme, "listing");
    if (errored) return renderResultError(call, theme, result, "list failed");

    const nodes = parseListResult(result);
    const total = countNodes(nodes);
    const summary = total === 0
      ? theme.fg("muted", "empty")
      : theme.fg("success", `${total} node${total === 1 ? "" : "s"}`);
    let text = `${call}${theme.fg("dim", ` · ${summary}`)}`;

    if (total === 0) return lines(text);

    if (expanded) {
      const treeLines = renderNodeTree(nodes, theme, "", []);
      text += `\n${treeLines.join("\n")}`;
    } else {
      const topNodes = nodes.slice(0, 3);
      for (let i = 0; i < topNodes.length; i++) {
        const connector = i === topNodes.length - 1 && nodes.length <= 3 ? "└" : "├";
        const glyph = connector === "└" ? "  └ " : "  │ ";
        text += `\n${theme.fg("muted", glyph)}${formatNodeRow(topNodes[i]!, theme)}`;
      }
      const remaining = total - topNodes.length;
      if (remaining > 0)
        text += theme.fg("dim", ` · ${remaining} more · ctrl+o to expand`);
    }
    return lines(text);
  },
});
