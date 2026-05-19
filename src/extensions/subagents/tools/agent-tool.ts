import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { defineTool } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { Text } from "@earendil-works/pi-tui";
import {
  resolveType,
  getAgentConfig,
  getAvailableTypes,
  buildAgentListText,
} from "../agent-types.js";
import { normalizeMaxTurns, getDefaultMaxTurns } from "../agent-runner.js";
import {
  createOutputFilePath,
  writeInitialEntry,
  streamToOutputFile,
} from "../output-file.js";
import { resolveAgentInvocationConfig } from "../invocation-config.js";
import { resolveModel } from "../model-resolver.js";
import type { AgentManager } from "../agent-manager.js";
import type { SubagentType } from "../types.js";
import { formatMs } from "../formatting.js";
import { formatLifetimeTokens, getStatusNote, textResult } from "./utils.js";
import {
  createActivityTracker,
  type AgentWidget,
  type AgentActivity,
} from "../ui/agent-widget.js";

export interface AgentDetails {
  [key: string]: unknown;
  agentId: string;
  displayName: string;
  description: string;
  status: "foreground" | "background";
  toolUses: number;
  tokens: string;
  durationMs: number;
}

export function registerAgentTool(
  pi: ExtensionAPI,
  manager: AgentManager,
  widget: AgentWidget,
  agentActivity: Map<string, AgentActivity>,
) {
  pi.registerTool(
    defineTool({
      name: "Agent",
      label: "Agent",
      description: `Launch a new agent to handle complex, multi-step tasks autonomously.

The Agent tool launches specialized agents that autonomously handle complex tasks. Each agent type has specific capabilities and tools available to it.

Available agents:
${buildAgentListText()}

Guidelines:
- For parallel work, use run_in_background: true on each agent. Foreground calls run sequentially.
- Provide clear, detailed prompts so the agent can work autonomously.
- Use run_in_background for work you don't need immediately.
- Use resume with an agent ID to continue a previous agent's work.
- Use steer_subagent to send mid-run messages to a running background agent.`,
      parameters: Type.Object({
        prompt: Type.String({
          description: "The task for the agent to perform.",
        }),
        description: Type.String({
          description:
            "A short (3-5 word) description of the task (shown in UI).",
        }),
        subagent_type: Type.String({
          description: `The type of specialized agent to use. Available types: ${getAvailableTypes().join(", ")}.`,
        }),
        model: Type.Optional(
          Type.String({
            description:
              'Optional model override. Accepts "provider/modelId" or fuzzy name (e.g. "haiku", "sonnet").',
          }),
        ),
        thinking: Type.Optional(
          Type.String({
            description:
              "Thinking level: off, minimal, low, medium, high, xhigh. Overrides agent default.",
          }),
        ),
        max_turns: Type.Optional(
          Type.Number({
            description: "Maximum number of agentic turns before stopping.",
            minimum: 1,
          }),
        ),
        run_in_background: Type.Optional(
          Type.Boolean({
            description:
              "Set to true to run in background. Returns agent ID immediately.",
          }),
        ),
        resume: Type.Optional(
          Type.String({
            description:
              "Optional agent ID to resume from. Continues from previous context.",
          }),
        ),
        isolated: Type.Optional(
          Type.Boolean({
            description:
              "If true, agent gets no extension/MCP tools — only built-in tools.",
          }),
        ),
        inherit_context: Type.Optional(
          Type.Boolean({
            description:
              "If true, fork parent conversation into the agent. Default: false.",
          }),
        ),
        isolation: Type.Optional(
          Type.Literal("worktree", {
            description:
              'Set to "worktree" to run in a temporary git worktree.',
          }),
        ),
      }),

      renderResult(result: any, _options: any, theme: any, _context: any) {
        const details = result.details as AgentDetails | undefined;
        if (!details) return new Text("", 0, 0);

        if (details.status === "background") {
          return new Text(
            theme.fg(
              "dim",
              `  ⎿  Running in background (ID: ${details.agentId})`,
            ),
            0,
            0,
          );
        }

        if (details.status === "foreground") {
          const icon = theme.fg("success", "✓");
          const statsParts: string[] = [
            `${details.toolUses} tool ${details.toolUses === 1 ? "use" : "uses"}`,
          ];
          if (details.tokens) statsParts.push(details.tokens);
          const duration = formatMs(details.durationMs);
          const header = `${icon} ${theme.fg("dim", details.displayName)} ${theme.fg("dim", "·")} ${theme.fg("dim", statsParts.join(", "))} ${theme.fg("dim", duration)}`;
          return new Text(header, 0, 0);
        }

        return new Text("", 0, 0);
      },

      execute: async (_toolCallId, params, signal, _onUpdate, ctx) => {
        const rawType = params.subagent_type as SubagentType;
        const resolved = resolveType(rawType);
        const subagentType = resolved ?? "general-purpose";
        const fellBack = resolved === undefined;
        const customConfig = getAgentConfig(subagentType);
        const resolvedConfig = resolveAgentInvocationConfig(
          customConfig,
          params,
        );

        let model = ctx.model;
        if (resolvedConfig.modelInput) {
          const resolved = resolveModel(
            resolvedConfig.modelInput,
            ctx.modelRegistry,
          );
          if (typeof resolved === "string") {
            if (resolvedConfig.modelFromParams) return textResult(resolved);
          } else {
            model = resolved;
          }
        }

        const thinking = resolvedConfig.thinking;
        const inheritContext = resolvedConfig.inheritContext;
        const runInBackground = resolvedConfig.runInBackground;
        const isolated = resolvedConfig.isolated;
        const isolation = resolvedConfig.isolation;
        const effectiveMaxTurns = normalizeMaxTurns(
          resolvedConfig.maxTurns ?? getDefaultMaxTurns(),
        );

        const parentModelId = ctx.model?.id;
        const effectiveModelId = model?.id;
        const modelName =
          effectiveModelId && effectiveModelId !== parentModelId
            ? (model?.name ?? effectiveModelId)
                .replace(/^Claude\s+/i, "")
                .toLowerCase()
            : undefined;

        if (params.resume) {
          const existing = manager.getRecord(params.resume);
          if (!existing) {
            return textResult(
              `Agent not found: "${params.resume}". It may have been cleaned up.`,
            );
          }
          if (!existing.session) {
            return textResult(
              `Agent "${params.resume}" has no active session to resume.`,
            );
          }
          const record = await manager.resume(
            params.resume,
            params.prompt,
            signal,
          );
          if (!record) {
            return textResult(`Failed to resume agent "${params.resume}".`);
          }
          return textResult(
            record.result?.trim() || record.error?.trim() || "No output.",
          );
        }

        if (runInBackground) {
          let id: string;
          try {
            const tracker = createActivityTracker(widget, agentActivity, {
              id: "__pending__",
            } as any);

            id = manager.spawn(pi, ctx, subagentType, params.prompt, {
              description: params.description,
              model,
              maxTurns: effectiveMaxTurns,
              isolated,
              inheritContext,
              thinkingLevel: thinking,
              isBackground: true,
              isolation,
              invocation: {
                modelName,
                thinking,
                maxTurns: normalizeMaxTurns(resolvedConfig.maxTurns),
                isolated,
                inheritContext,
                runInBackground,
                isolation,
              },
              onToolActivity: tracker.onToolActivity,
              onTextDelta: tracker.onTextDelta,
              onTurnEnd: tracker.onTurnEnd,
              onAssistantUsage: tracker.onAssistantUsage,
              onSessionCreated: (session) => {
                tracker.onSessionCreated();
                const rec = manager.getRecord(id);
                if (rec) {
                  rec.outputFile = createOutputFilePath(
                    ctx.cwd,
                    id,
                    ctx.sessionManager.getSessionId(),
                  );
                  writeInitialEntry(rec.outputFile, id, params.prompt, ctx.cwd);
                  rec.outputCleanup = streamToOutputFile(
                    session,
                    rec.outputFile,
                    id,
                    ctx.cwd,
                  );
                }
              },
            });

            const activity = agentActivity.get("__pending__");
            if (activity) {
              agentActivity.delete("__pending__");
              agentActivity.set(id, activity);
            }
          } catch (err) {
            return textResult(err instanceof Error ? err.message : String(err));
          }

          const record = manager.getRecord(id);
          if (record) {
            record.toolCallId = _toolCallId;
          }

          widget.ensureTimer();
          widget.update();

          pi.events.emit("subagents:created", {
            id,
            type: subagentType,
            description: params.description,
            isBackground: true,
          });

          const isQueued = record?.status === "queued";
          const displayName = customConfig?.displayName ?? subagentType;
          const details: AgentDetails = {
            agentId: id,
            displayName,
            description: params.description,
            status: "background",
            toolUses: 0,
            tokens: "",
            durationMs: 0,
          };
          return textResult(
            `Agent ${isQueued ? "queued" : "started"} in background.\n` +
              `Agent ID: ${id}\n` +
              `Type: ${displayName}\n` +
              `Description: ${params.description}\n` +
              (record?.outputFile
                ? `Output file: ${record.outputFile}\n`
                : "") +
              (isQueued
                ? `Position: queued (max ${manager.getMaxConcurrent()} concurrent)\n`
                : "") +
              `\nYou will be notified when this agent completes.\n` +
              `Use get_subagent_result to retrieve full results, or steer_subagent to send it messages.\n` +
              `Do not duplicate this agent's work.`,
            details,
          );
        }

        widget.ensureTimer();
        widget.update();

        let record;
        try {
          const fgTracker = {
            onSessionCreated: (_session: any) => {},
          };
          record = await manager.spawnAndWait(
            pi,
            ctx,
            subagentType,
            params.prompt,
            {
              description: params.description,
              model,
              maxTurns: effectiveMaxTurns,
              isolated,
              inheritContext,
              thinkingLevel: thinking,
              isolation,
              invocation: {
                modelName,
                thinking,
                maxTurns: normalizeMaxTurns(resolvedConfig.maxTurns),
                isolated,
                inheritContext,
                runInBackground,
                isolation,
              },
              signal,
              onSessionCreated: (session) => {
                fgTracker.onSessionCreated(session);
              },
            },
          );
        } catch (err) {
          return textResult(err instanceof Error ? err.message : String(err));
        }

        widget.markFinished(record.id);
        widget.update();

        const tokenText = formatLifetimeTokens(record);
        const fallbackNote = fellBack
          ? `Note: Unknown agent type "${rawType}" — using general-purpose.\n\n`
          : "";

        if (record.status === "error") {
          return textResult(`${fallbackNote}Agent failed: ${record.error}`);
        }

        const durationMs =
          (record.completedAt ?? Date.now()) - record.startedAt;
        const statsParts = [`${record.toolUses} tool uses`];
        if (tokenText) statsParts.push(tokenText);
        const displayName = customConfig?.displayName ?? subagentType;
        const details: AgentDetails = {
          agentId: record.id,
          displayName,
          description: params.description,
          status: "foreground",
          toolUses: record.toolUses,
          tokens: tokenText,
          durationMs,
        };
        return textResult(
          `${fallbackNote}Agent completed in ${formatMs(durationMs)} (${statsParts.join(", ")})${getStatusNote(record.status)}.\n\n` +
            (record.result?.trim() || "No output."),
          details,
        );
      },
    }),
  );
}
