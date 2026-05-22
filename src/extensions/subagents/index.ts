import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { registerAgents } from "./agent-types.js";
import { AgentManager } from "./agent-manager.js";
import { registerAgentTool } from "./tools/agent-tool.js";
import { registerGetResultTool } from "./tools/get-result-tool.js";
import { registerSteerTool } from "./tools/steer-tool.js";
import { registerAgentsCommand } from "./commands/agents-command.js";
import {
  emitAgentCompleted,
  emitAgentFailed,
  emitAgentStarted,
  emitReady,
} from "./events.js";
import { AgentWidget, type AgentActivity } from "./ui/agent-widget.js";
import {
  recordToNotification,
  formatTaskNotification,
  registerNotificationRenderer,
} from "./ui/notifications.js";
import { ScheduleEngine } from "./schedule.js";
import {
  loadCustomAgents,
  collectExtensionAgentDirs,
} from "./custom-agents.js";

export default function initSubagents(pi: ExtensionAPI): void {
  registerAgents(new Map());

  const agentActivity = new Map<string, AgentActivity>();

  const manager = new AgentManager(
    (record) => {
      if (record.status === "error") {
        emitAgentFailed(pi, record);
      } else {
        emitAgentCompleted(pi, record);
      }

      agentActivity.delete(record.id);
      widget.markFinished(record.id);
      widget.update();

      if (record.result && !record.resultConsumed) {
        const notification = formatTaskNotification(record);
        const footer = record.outputFile
          ? `\nFull transcript available at: ${record.outputFile}`
          : "";
        pi.sendMessage(
          {
            customType: "subagent-notification",
            content: notification + footer,
            display: true,
            details: recordToNotification(record),
          },
          { deliverAs: "followUp" },
        );
      }
    },
    4,
    (record) => {
      emitAgentStarted(pi, record);
      widget.update();
    },
  );

  const widget = new AgentWidget(manager, agentActivity);

  const scheduler = new ScheduleEngine(process.cwd());

  registerNotificationRenderer(pi);

  pi.on("tool_execution_start", async (_event, ctx) => {
    if (ctx.hasUI) {
      widget.setUICtx(ctx.ui as any);
      widget.onTurnStart();
    }
  });

  pi.on("session_start", async (_event, ctx) => {
    manager.clearCompleted();

    const settings = (ctx as any).settingsManager;
    const extraDirs = settings
      ? collectExtensionAgentDirs(
          settings.getProjectSettings?.()?.extensions ?? [],
          settings.getPackages?.() ?? [],
          ctx.cwd,
        )
      : [];
    const customAgents = loadCustomAgents(ctx.cwd, extraDirs);
    registerAgents(customAgents);

    scheduler.bind(manager, pi);
    scheduler.load();
    scheduler.start();

    emitReady(pi);
  });

  pi.on("session_shutdown", async () => {
    manager.abortAll();
    scheduler.dispose();
    widget.dispose();
  });

  registerAgentTool(pi, manager, widget, agentActivity);

  registerGetResultTool(pi, manager);
  registerSteerTool(pi, manager);
  registerAgentsCommand(pi, manager, scheduler);

  // ── RPC Bridge for task execution (subagents:rpc:*) ──
  let latestRpcCtx: ExtensionContext | undefined;

  const captureRpcCtx = (_event: any, ctx: ExtensionContext) => {
    latestRpcCtx = ctx;
  };
  pi.on("tool_execution_start", captureRpcCtx);
  pi.on("session_start", captureRpcCtx);

  // RPC: Ping (protocol version handshake)
  pi.events.on("subagents:rpc:ping", (raw: unknown) => {
    const data = raw as { requestId: string };
    pi.events.emit(`subagents:rpc:ping:reply:${data.requestId}`, {
      success: true,
      data: { version: 2 },
    });
  });

  // RPC: Spawn — spawn a background agent and return its ID
  pi.events.on("subagents:rpc:spawn", (raw: unknown) => {
    const data = raw as {
      requestId: string;
      type: string;
      prompt: string;
      options?: any;
    };
    if (!latestRpcCtx) {
      pi.events.emit(`subagents:rpc:spawn:reply:${data.requestId}`, {
        success: false,
        error: "No context available",
      });
      return;
    }
    try {
      const agentId = manager.spawn(pi, latestRpcCtx, data.type, data.prompt, {
        description: data.options?.description ?? data.type,
        isBackground: true,
        maxTurns: data.options?.maxTurns,
        ...(data.options?.model ? { model: data.options.model } : {}),
      });
      pi.events.emit(`subagents:rpc:spawn:reply:${data.requestId}`, {
        success: true,
        data: { id: agentId },
      });
    } catch (err: any) {
      pi.events.emit(`subagents:rpc:spawn:reply:${data.requestId}`, {
        success: false,
        error: err.message,
      });
    }
  });

  // RPC: Stop — abort a running agent
  pi.events.on("subagents:rpc:stop", (raw: unknown) => {
    const data = raw as {
      requestId: string;
      agentId: string;
    };
    try {
      manager.abort(data.agentId);
      pi.events.emit(`subagents:rpc:stop:reply:${data.requestId}`, {
        success: true,
      });
    } catch (err: any) {
      pi.events.emit(`subagents:rpc:stop:reply:${data.requestId}`, {
        success: false,
        error: err.message,
      });
    }
  });
}
