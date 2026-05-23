import type {
  ExtensionContext as PiExtensionContext,
  ModelRegistry as PiModelRegistry,
} from "@earendil-works/pi-coding-agent";
import { Temporal } from "temporal-polyfill";
import { getZaiUsage, type ZaiUsageData } from "./usage.js";

export type FetchUsageFn = (
  modelRegistry: Pick<PiModelRegistry, "getApiKeyForProvider">,
) => Promise<ZaiUsageData>;

/** Latest Z.ai quota (TOKENS_LIMIT %), for compact statusline and similar UIs. */
export interface ZaiUsageSnapshot {
  percentage: number;
  timeRemaining?: string;
  fetchedAtMs: number;
}

let zaiUsageSnapshot: ZaiUsageSnapshot | null = null;

export function getZaiUsageSnapshot(): ZaiUsageSnapshot | null {
  return zaiUsageSnapshot;
}

function setZaiUsageSnapshot(data: ZaiUsageSnapshot | null): void {
  zaiUsageSnapshot = data;
}

export class ZaiUsageCache {
  private lastUsage: ZaiUsageData | null = null;
  private lastFetchTime = 0;
  private static readonly FETCH_COOLDOWN_MS = 30_000;

  private setStatusFromUsage(
    ctx: PiExtensionContext,
    usageData: ZaiUsageData,
  ): void {
    const now = Temporal.Now.instant().epochMilliseconds;
    setZaiUsageSnapshot({
      percentage: usageData.percentage,
      timeRemaining: usageData.timeRemaining,
      fetchedAtMs: now,
    });
    const theme = ctx.ui.theme;
    const displayPercentage = Math.round(usageData.percentage * 10) / 10;
    let status =
      theme.fg("muted", "Z.ai:") + theme.fg("accent", `${displayPercentage}%`);
    if (usageData.resetTime && usageData.timeRemaining) {
      status += ` ${theme.fg("dim", `(${usageData.timeRemaining})`)}`;
    }
    ctx.ui.setStatus("zai-usage", status);
  }

  async updateStatus(
    ctx: PiExtensionContext,
    fetchUsage: FetchUsageFn = getZaiUsage,
  ): Promise<void> {
    try {
      const now = Temporal.Now.instant().epochMilliseconds;

      if (
        this.lastUsage &&
        this.lastFetchTime &&
        now - this.lastFetchTime < ZaiUsageCache.FETCH_COOLDOWN_MS
      ) {
        this.setStatusFromUsage(ctx, this.lastUsage);
        return;
      }

      const usage = await fetchUsage(ctx.modelRegistry);
      this.lastUsage = usage;
      this.lastFetchTime = now;

      this.setStatusFromUsage(ctx, usage);
    } catch (error) {
      console.error(`Error updating Z.ai usage: ${error}`);
      this.clear(ctx);
    }
  }

  clear(ctx: PiExtensionContext): void {
    ctx.ui.setStatus("zai-usage", undefined);
    setZaiUsageSnapshot(null);
  }
}

export function isZaiProvider(provider: string | undefined): boolean {
  return provider?.toLowerCase().startsWith("zai") ?? false;
}

export function isCurrentModelZai(ctx: PiExtensionContext): boolean {
  return isZaiProvider(ctx.model?.provider);
}
