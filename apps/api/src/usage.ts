import type { Db } from "./db.js";
import { ApiError } from "./errors.js";

type EntitlementRow = {
  ai_drafts_per_month: number;
  visual_generations_per_month: number;
  video_renders_per_month: number;
  deck_exports_per_month: number;
};

type UsageRow = {
  used: string | number | null;
};

export async function assertAiDraftUsageAvailable(db: Db, workspaceId: string, quantity: number): Promise<void> {
  return assertMonthlyUsageAvailable(db, workspaceId, quantity, {
    entitlementColumn: "ai_drafts_per_month",
    eventType: "ai_draft",
    unavailableMessage: "AI draft generation is not available on this plan",
    limitMessage: "AI draft generation limit exceeded for this month",
  });
}

export async function assertVisualGenerationUsageAvailable(db: Db, workspaceId: string, quantity: number): Promise<void> {
  return assertMonthlyUsageAvailable(db, workspaceId, quantity, {
    entitlementColumn: "visual_generations_per_month",
    eventType: "visual_generation",
    unavailableMessage: "Visual generation is not available on this plan",
    limitMessage: "Visual generation limit exceeded for this month",
  });
}

export async function assertVideoRenderUsageAvailable(db: Db, workspaceId: string, quantity: number): Promise<void> {
  return assertMonthlyUsageAvailable(db, workspaceId, quantity, {
    entitlementColumn: "video_renders_per_month",
    eventType: "video_render",
    unavailableMessage: "Video rendering is not available on this plan",
    limitMessage: "Video rendering limit exceeded for this month",
  });
}

export async function assertDeckExportUsageAvailable(db: Db, workspaceId: string, quantity: number): Promise<void> {
  return assertMonthlyUsageAvailable(db, workspaceId, quantity, {
    entitlementColumn: "deck_exports_per_month",
    eventType: "deck_export",
    unavailableMessage: "Deck export is not available on this plan",
    limitMessage: "Deck export limit exceeded for this month",
  });
}

async function assertMonthlyUsageAvailable(
  db: Db,
  workspaceId: string,
  quantity: number,
  options: {
    entitlementColumn: keyof EntitlementRow;
    eventType: string;
    unavailableMessage: string;
    limitMessage: string;
  },
): Promise<void> {
  const entitlement = await db.one<EntitlementRow>(
    `
      SELECT ai_drafts_per_month, visual_generations_per_month, video_renders_per_month, deck_exports_per_month
      FROM entitlements
      WHERE workspace_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [workspaceId],
  );
  const monthlyLimit = Number(entitlement?.[options.entitlementColumn] ?? 0);
  if (monthlyLimit <= 0) {
    throw new ApiError(402, options.unavailableMessage);
  }

  const usage = await db.one<UsageRow>(
    `
      SELECT COALESCE(SUM(quantity), 0) AS used
      FROM usage_events
      WHERE workspace_id = $1
        AND event_type = $2
        AND created_at >= date_trunc('month', now())
    `,
    [workspaceId, options.eventType],
  );
  const used = Number(usage?.used ?? 0);
  if (used + quantity > monthlyLimit) {
    throw new ApiError(402, options.limitMessage);
  }
}
