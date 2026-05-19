import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerModels from "./models.js";
import { getZaiUsage } from "./usage.js";
import { isCurrentModelZai, isZaiProvider, ZaiUsageCache } from "./status.js";

export default function registerZai(pi: ExtensionAPI) {
  registerModels(pi);

  const cache = new ZaiUsageCache();

  pi.on("session_start", async (_event, ctx) => {
    if (isCurrentModelZai(ctx)) {
      await cache.updateStatus(ctx);
    }
  });

  pi.on("model_select", async (event, ctx) => {
    if (isZaiProvider(event.model.provider)) {
      await cache.updateStatus(ctx);
    } else {
      cache.clear(ctx);
    }
  });

  pi.on("turn_end", async (_event, ctx) => {
    if (isCurrentModelZai(ctx)) {
      await cache.updateStatus(ctx);
    }
  });

  pi.on("session_shutdown", async (_event, ctx) => {
    cache.clear(ctx);
  });

  pi.registerCommand("zai-usage", {
    description: "Check Z.ai plan usage quota",
    handler: async (_args, ctx) => {
      try {
        const usage = await getZaiUsage(ctx.modelRegistry);
        const pct = Math.round(usage.percentage * 10) / 10;
        let msg = `Z.ai usage: ${pct}%`;
        if (usage.timeRemaining) {
          msg += ` — resets in ${usage.timeRemaining}`;
        }
        ctx.ui.notify(msg, "info");
      } catch (err) {
        ctx.ui.notify(`Failed to fetch usage: ${err}`, "error");
      }
    },
  });
}
