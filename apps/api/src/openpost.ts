import { badRequest } from "./errors.js";

export type OpenPostClient = {
  createPost: (input: OpenPostCreatePostInput) => Promise<OpenPostPostResponse>;
};

export type OpenPostCreatePostInput = {
  userId: string;
  userEmail: string;
  workspaceId: string;
  projectId?: string | null;
  content: string;
  scheduledAt?: string | null;
  socialAccountIds: string[];
  randomDelayMinutes?: number;
  sourceDraftId: string;
  sourceNoteIds: string[];
  mediaAssetIds: string[];
  mode: string;
  channel: string;
  contentType: string;
  targetAudience: string;
  purpose: string;
  claimsUsed: string[];
  missingInfo: string[];
  riskNotes: string;
};

export type OpenPostPostResponse = {
  id: string;
  status: string;
  approval_status: string;
  scheduled_at?: string;
};

export function createOpenPostClient(baseUrl: string, internalToken: string): OpenPostClient {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/u, "");

  async function createPost(input: OpenPostCreatePostInput): Promise<OpenPostPostResponse> {
    if (!internalToken) {
      throw badRequest("OpenPost internal token is not configured");
    }

    const response = await fetch(`${normalizedBaseUrl}/api/v1/posts`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-socialops-internal-token": internalToken,
        "x-socialops-user-id": input.userId,
        "x-socialops-user-email": input.userEmail,
      },
      body: JSON.stringify({
        workspace_id: input.workspaceId,
        project_id: input.projectId ?? "",
        content: input.content,
        scheduled_at: input.scheduledAt ?? undefined,
        social_account_ids: input.socialAccountIds,
        random_delay_minutes: input.randomDelayMinutes ?? 0,
        approval_status: "approved",
        manual_publish_status: input.scheduledAt ? "not_applicable" : "ready",
        content_mode: input.mode,
        channel: input.channel,
        content_type: input.contentType,
        target_audience: input.targetAudience,
        purpose: input.purpose,
        source_draft_id: input.sourceDraftId,
        source_note_ids: JSON.stringify(input.sourceNoteIds),
        media_asset_ids: JSON.stringify(input.mediaAssetIds),
        claims_used: JSON.stringify(input.claimsUsed),
        missing_info: JSON.stringify(input.missingInfo),
        risk_notes: input.riskNotes,
        generated_by_ai: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw badRequest(`OpenPost create post failed: ${response.status} ${text}`);
    }

    return (await response.json()) as OpenPostPostResponse;
  }

  return { createPost };
}
