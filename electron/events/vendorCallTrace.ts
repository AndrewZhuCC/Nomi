// vendor 调用 → NomiEvent 旁路(harness S4-1,治"接入必漂"的数据枢纽)。
// 纪律(§4.3):只记终态——requested 在任务受理时记一次,completed 在 status 终态时记一次;
// 轮询中间 tick 不入日志(进度走 S2 的瞬态通道)。runId = vendor 域配对键(§1.1)。
import crypto from "node:crypto";
import { appendEvents } from "./eventLogRepository";
import type { NormalizedRecipe } from "../vendor/provenance";
import type { VendorErrorStructured } from "../vendor/vendorHttp";

const mintId = () => `evt_${crypto.randomUUID().slice(0, 12)}`;

export function traceVendorRequested(
  projectId: string | undefined,
  payload: { runId: string; nodeId?: string; recipe: NormalizedRecipe },
): void {
  const id = String(projectId || "").trim();
  if (!id) return;
  appendEvents(id, [
    {
      id: mintId(),
      source: "runtime",
      type: "vendor.call.requested",
      payload: { runId: payload.runId, ...(payload.nodeId ? { nodeId: payload.nodeId } : {}), recipe: payload.recipe },
    },
  ]);
}

export function traceVendorCompleted(
  projectId: string | undefined,
  payload: { runId: string; nodeId?: string; status: "succeeded" | "failed"; assetCount: number; error?: VendorErrorStructured },
): void {
  const id = String(projectId || "").trim();
  if (!id) return;
  appendEvents(id, [
    {
      id: mintId(),
      source: "runtime",
      type: "vendor.call.completed",
      payload: {
        runId: payload.runId,
        ...(payload.nodeId ? { nodeId: payload.nodeId } : {}),
        status: payload.status,
        assetCount: payload.assetCount,
        ...(payload.error ? { error: payload.error } : {}),
      },
    },
  ]);
}
