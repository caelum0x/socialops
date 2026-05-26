import fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

import type { QueryResultRow } from "pg";

import type { DeckWorkerClient } from "./deck-worker.js";
import type { Db } from "./db.js";
import type { OpenPostClient } from "./openpost.js";
import { registerRoutes } from "./routes.js";
import type { ComfyUiClient } from "@socialops/integrations/comfyui";
import type { PokeeResearchClient } from "@socialops/integrations/pokee";
import type { VisualWorkerClient } from "./visual-worker.js";
import type { VideoWorkerCaptureScene, VideoWorkerClient, VideoWorkerSceneInput } from "./video-worker.js";
import type { MiniClawClient } from "./miniclaw.js";
import type { WhisperClient } from "./whisper.js";
import type { VideoProviderRouter } from "./video-providers.js";
import { createStorageClient } from "./storage.js";

function createMockDb(options: { draftStatus?: string; notes?: QueryResultRow[] } = {}): Db {
  const draftStatus = options.draftStatus ?? "approved";

  return {
    pool: {} as Db["pool"],
    async query<T extends QueryResultRow = QueryResultRow>(sql: string) {
      if (sql.includes("FROM capture_notes")) {
        return (options.notes ?? []) as T[];
      }
      if (sql.includes("FROM media_assets")) {
        return [{ id: "44444444-4444-4444-8444-444444444444" }] as unknown as T[];
      }
      if (sql.includes("FROM content_calendar_items")) {
        return [
          {
            id: "cal-1",
            content_draft_id: "00000000-0000-0000-0000-000000000010",
            platform: "linkedin",
            scheduled_for: "2026-06-01T10:00:00.000Z",
            status: "scheduled",
            draft_title: "Linked update",
            draft_hook: "Real work, real reach.",
            draft_channel: "linkedin",
          },
        ] as unknown as T[];
      }
      if (sql.includes("FROM content_drafts") && sql.includes("scheduled_for IS NOT NULL")) {
        return [
          {
            id: "00000000-0000-0000-0000-000000000011",
            title: "Founder weekly recap",
            hook: "What I shipped this week",
            channel: "x",
            status: "scheduled",
            scheduled_for: "2026-06-02T15:00:00.000Z",
            openpost_post_id: "op-post-2",
          },
        ] as unknown as T[];
      }
      if (sql.includes("FROM applications") && sql.includes("ORDER BY created_at DESC")) {
        return [
          {
            id: "aaaa1111-1111-4111-8111-aaaaaaaaaaaa",
            name: "YC W27",
            type: "accelerator",
            status: "draft",
          },
        ] as unknown as T[];
      }
      if (sql.includes("FROM application_answers")) {
        return [
          {
            id: "aaaa2222-2222-4222-8222-aaaaaaaaaaaa",
            application_id: "aaaa1111-1111-4111-8111-aaaaaaaaaaaa",
            question: "Why now?",
            answer: "Because the workflow is real.",
            status: "draft",
          },
        ] as unknown as T[];
      }
      if (sql.includes("FROM leads") && sql.includes("ORDER BY created_at DESC")) {
        return [
          {
            id: "bbbb1111-1111-4111-8111-bbbbbbbbbbbb",
            name: "Lead Alpha",
            status: "new",
            segment: "founder",
          },
        ] as unknown as T[];
      }
      if (sql.includes("FROM outreach_messages") && sql.includes("ORDER BY created_at DESC")) {
        return [
          {
            id: "cccc1111-1111-4111-8111-cccccccccccc",
            channel: "linkedin",
            status: "draft",
            body: "Hi, saw your post about SocialOps.",
          },
        ] as unknown as T[];
      }
      if (sql.includes("FROM product_demo_scenes") && !sql.includes("LEFT JOIN")) {
        return [
          {
            id: "eeee1111-1111-4111-8111-eeeeeeeeeeee",
            order: 1,
            url: "https://vcpeer.local/terminal",
            action_description: "Open VCPeer Terminal",
            caption: "VCPeer Terminal",
            duration_seconds: 5,
          },
          {
            id: "eeee2222-2222-4222-8222-eeeeeeeeeeee",
            order: 2,
            url: "https://vcpeer.local/terminal",
            action_description: "Ask about an investor",
            caption: "Investor question",
            duration_seconds: 6,
          },
        ] as unknown as T[];
      }
      if (sql.includes("FROM product_demo_scenes") && sql.includes("LEFT JOIN media_assets")) {
        return [
          {
            id: "eeee1111-1111-4111-8111-eeeeeeeeeeee",
            order: 1,
            caption: "VCPeer Terminal",
            narration: "Open the product.",
            action_description: "Open VCPeer Terminal",
            duration_seconds: 5,
            screenshot_url: "/tmp/socialops-capture/dddd1111-1111-4111-8111-dddddddddddd/scene-1.png",
            screen_recording_url: null,
            screenshot_kind: "image",
            screen_recording_kind: null,
          },
          {
            id: "eeee2222-2222-4222-8222-eeeeeeeeeeee",
            order: 2,
            caption: "Investor question",
            narration: "Ask about an investor.",
            action_description: "Ask about an investor",
            duration_seconds: 6,
            screenshot_url: "/tmp/socialops-capture/dddd1111-1111-4111-8111-dddddddddddd/scene-2.png",
            screen_recording_url: null,
            screenshot_kind: "image",
            screen_recording_kind: null,
          },
        ] as unknown as T[];
      }
      if (sql.includes("FROM content_drafts") && sql.includes("channel = ANY")) {
        return [
          {
            id: "11111111-1111-4111-8111-111111111111",
            channel: "x",
            title: "VCPeer build note",
            hook: "I fixed a product workflow bug today.",
            content: "I shipped a VCPeer workflow fix because the previous handoff was too slow. The lesson: distribution starts with clearer product proof.",
            status: "approved",
            created_at: "2026-05-20T09:00:00.000Z",
            updated_at: "2026-05-21T09:00:00.000Z",
            media_asset_ids_json: ["44444444-4444-4444-8444-444444444444"],
            claims_used_json: ["VCPeer workflow fix shipped"],
            missing_info_json: [],
            metrics_json: { impressions: 1000, likes: 80, replies: 12, reposts: 8 },
          },
          {
            id: "22222222-2222-4222-8222-222222222222",
            channel: "x",
            title: "Generic note",
            hook: "Thoughts on content.",
            content: "A generic idea without much project context.",
            status: "draft",
            created_at: "2026-04-01T09:00:00.000Z",
            updated_at: "2026-04-01T09:00:00.000Z",
            media_asset_ids_json: [],
            claims_used_json: [],
            missing_info_json: ["capture_notes"],
            metrics_json: { impressions: 1000, likes: 2 },
          },
        ] as unknown as T[];
      }
      if (sql.includes("workspaces")) {
        return [] as T[];
      }
      return [{ ok: 1 }] as unknown as T[];
    },
    async one<T extends QueryResultRow = QueryResultRow>(sql: string) {
      if (sql.includes("SELECT 1 AS ok")) {
        return { ok: 1 } as unknown as T;
      }
      if (sql.includes("INSERT INTO users")) {
        return {
          id: "00000000-0000-0000-0000-000000000001",
          email: "dev@socialops.local",
          name: "SocialOps Dev",
          role: "user",
        } as unknown as T;
      }
      if (sql.includes("SELECT role") && sql.includes("workspace_members")) {
        return { role: "owner" } as unknown as T;
      }
      if (sql.includes("SELECT ai_drafts_per_month")) {
        return {
          ai_drafts_per_month: 100,
          visual_generations_per_month: 10,
          video_renders_per_month: 5,
          deck_exports_per_month: 5,
        } as unknown as T;
      }
      if (sql.includes("COALESCE(SUM(quantity)")) {
        return { used: 0 } as unknown as T;
      }
      if (sql.includes("SELECT * FROM personal_profiles")) {
        return {
          name: "Arhan",
          headline: "Student founder building SocialOps",
          skills_json: ["SQL", "Power BI", "product"],
          goals_json: ["build public proof"],
        } as unknown as T;
      }
      if (sql.includes("SELECT * FROM career_profiles")) {
        return {
          current_role: "student founder",
          target_roles_json: ["product builder"],
          skills_to_show_json: ["analytics", "software"],
        } as unknown as T;
      }
      if (sql.includes("SELECT id FROM projects")) {
        return { id: "00000000-0000-0000-0000-000000000050" } as unknown as T;
      }
      if (sql.includes("SELECT id FROM agency_clients")) {
        return { id: "22222222-2222-4222-8222-222222222222" } as unknown as T;
      }
      if (sql.includes("SELECT id FROM capture_notes")) {
        return { id: "00000000-0000-0000-0000-000000000040" } as unknown as T;
      }
      if (sql.includes("SELECT id FROM campaigns")) {
        return { id: "33333333-3333-4333-8333-333333333333" } as unknown as T;
      }
      if (sql.includes("SELECT id FROM content_drafts")) {
        return { id: "00000000-0000-0000-0000-000000000010" } as unknown as T;
      }
      if (sql.includes("SELECT id") && sql.includes("openpost_post_id")) {
        return { id: "00000000-0000-0000-0000-000000000010" } as unknown as T;
      }
      if (sql.includes("INSERT INTO brand_profiles")) {
        return {
          id: "brand-1",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          company_name: "SocialOps",
          platforms_json: ["linkedin", "x", "tiktok"],
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO agency_clients")) {
        return {
          id: "22222222-2222-4222-8222-222222222222",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          name: "Beta Client",
          slug: "beta-client",
          status: "active",
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO campaigns")) {
        return {
          id: "33333333-3333-4333-8333-333333333333",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          name: "Launch campaign",
          status: "active",
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO media_assets") && sql.includes("'upload'")) {
        return {
          id: "55551111-1111-4111-8111-555555555555",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          source: "upload",
          media_kind: "video",
          status: "approved",
          url: "https://media.example.com/uploads/clip.mp4",
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO media_assets")) {
        return {
          id: "44444444-4444-4444-8444-444444444444",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          media_kind: "video",
          source: "external",
          status: "approved",
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO ugc_briefs")) {
        return {
          id: "55555555-5555-4555-8555-555555555555",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          title: "UGC launch brief",
          status: "needs_review",
        } as unknown as T;
      }
      if (sql.includes("SELECT * FROM ugc_briefs")) {
        return {
          id: "55555555-5555-4555-8555-555555555555",
          agency_client_id: "22222222-2222-4222-8222-222222222222",
          project_id: null,
          campaign_id: "33333333-3333-4333-8333-333333333333",
          title: "UGC launch brief",
          product_or_offer: "SocialOps setup",
          target_audience: "agency owners",
          hooks_json: ["Stop posting random content"],
          talking_points_json: ["Capture real work", "Approve before posting"],
          do_not_say_json: ["guaranteed virality"],
          deliverables_json: [{ type: "short_video", count: 3 }],
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO research_briefs")) {
        return {
          id: "00000000-0000-0000-0000-000000000060",
          status: "needs_review",
          topic: "social media scheduling API limits",
          summary: "Research summary",
          citations_json: [{ title: "API limits", url: "https://example.com/limits" }],
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO applications")) {
        return {
          id: "aaaa1111-1111-4111-8111-aaaaaaaaaaaa",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          name: "YC W27",
          type: "accelerator",
          status: "draft",
        } as unknown as T;
      }
      if (sql.includes("FROM applications") && sql.includes("WHERE id = $1 AND workspace_id = $2") && !sql.includes("SELECT id ")) {
        return {
          id: "aaaa1111-1111-4111-8111-aaaaaaaaaaaa",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          name: "YC W27",
          type: "accelerator",
          status: "draft",
        } as unknown as T;
      }
      if (sql.includes("SELECT id FROM applications")) {
        return { id: "aaaa1111-1111-4111-8111-aaaaaaaaaaaa" } as unknown as T;
      }
      if (sql.includes("INSERT INTO application_answers")) {
        return {
          id: "aaaa2222-2222-4222-8222-aaaaaaaaaaaa",
          application_id: "aaaa1111-1111-4111-8111-aaaaaaaaaaaa",
          question: "Why now?",
          answer: "Because the workflow is real.",
          status: "draft",
          missing_info_json: [],
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO leads")) {
        return {
          id: "bbbb1111-1111-4111-8111-bbbbbbbbbbbb",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          name: "Lead Alpha",
          status: "new",
          segment: "founder",
        } as unknown as T;
      }
      if (sql.includes("UPDATE leads SET")) {
        return {
          id: "bbbb1111-1111-4111-8111-bbbbbbbbbbbb",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          name: "Lead Alpha",
          status: "contacted",
        } as unknown as T;
      }
      if (sql.includes("SELECT id FROM leads")) {
        return { id: "bbbb1111-1111-4111-8111-bbbbbbbbbbbb" } as unknown as T;
      }
      if (sql.includes("SELECT id, url, media_kind FROM media_assets")) {
        return {
          id: "55551111-1111-4111-8111-555555555555",
          url: "https://media.example.com/uploads/clip.mp4",
          media_kind: "video",
        } as unknown as T;
      }
      if (sql.includes("SELECT id, metadata_json FROM media_assets")) {
        return {
          id: "55551111-1111-4111-8111-555555555555",
          metadata_json: { duration_seconds: 60 },
        } as unknown as T;
      }
      if (sql.includes("SELECT id, url, rights_json FROM media_assets")) {
        return {
          id: "55551111-1111-4111-8111-555555555555",
          url: "https://media.example.com/uploads/clip.mp4",
          rights_json: { is_real_user: true },
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO video_jobs") && sql.includes("'people-video'")) {
        return {
          id: "77771111-1111-4111-8111-777777777777",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          template_key: "people-video",
          status: "queued",
          render_provider: "ffmpeg",
          aspect_ratio: "9:16",
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO outreach_messages")) {
        return {
          id: "cccc1111-1111-4111-8111-cccccccccccc",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          lead_id: "bbbb1111-1111-4111-8111-bbbbbbbbbbbb",
          channel: "linkedin",
          body: "Hi, saw your post about SocialOps.",
          status: "draft",
        } as unknown as T;
      }
      if (sql.includes("UPDATE outreach_messages") && sql.includes("status = 'sent'")) {
        return {
          id: "cccc1111-1111-4111-8111-cccccccccccc",
          status: "sent",
          sent_at: "2026-05-26T12:00:00.000Z",
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO product_demo_projects")) {
        return {
          id: "dddd1111-1111-4111-8111-dddddddddddd",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          product_name: "VCPeer Terminal",
          product_url: "https://vcpeer.local/terminal",
          goal: "Show how the terminal answers an investor question.",
          platform: "linkedin",
          status: "planning",
        } as unknown as T;
      }
      if (sql.includes("FROM product_demo_projects") && sql.includes("WHERE id = $1 AND workspace_id = $2")) {
        return {
          id: "dddd1111-1111-4111-8111-dddddddddddd",
          product_name: "VCPeer Terminal",
          product_url: "https://vcpeer.local/terminal",
          goal: "Show how the terminal answers an investor question.",
          platform: "linkedin",
          project_id: null,
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO video_jobs") && sql.includes("template_key") && sql.includes("'queued'") && sql.includes("'ffmpeg'")) {
        return {
          id: "ffff1111-1111-4111-8111-ffffffffffff",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          template_key: "product-demo",
          status: "queued",
          render_provider: "ffmpeg",
          aspect_ratio: "9:16",
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO decks")) {
        return {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          title: "Career proof deck",
          renderer: "marp",
          status: "needs_review",
          markdown: "# Career proof deck",
        } as unknown as T;
      }
      if (sql.includes("SELECT id, title, markdown, renderer, status") && sql.includes("FROM decks")) {
        return {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          title: "Career proof deck",
          renderer: "marp",
          status: draftStatus === "approved" ? "approved" : "needs_review",
          markdown: "---\nmarp: true\n---\n# Career proof deck",
        } as unknown as T;
      }
      if (sql.includes("SELECT id, external_provider, external_job_id, status") && sql.includes("FROM visual_assets")) {
        return {
          id: "00000000-0000-0000-0000-000000000070",
          external_provider: "visual-worker",
          external_job_id: "prompt-1",
          status: "generating",
        } as unknown as T;
      }
      if (sql.includes("UPDATE visual_assets")) {
        return {
          id: "00000000-0000-0000-0000-000000000070",
          status: "generated",
          output_url: "https://media.example.com/visual.png",
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO video_scripts")) {
        return {
          id: "66666666-6666-4666-8666-666666666666",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          content_draft_id: "00000000-0000-0000-0000-000000000010",
          platform: "tiktok",
          mode: "project",
          hook: "Approved draft",
          status: "draft",
          scenes_json: [{ order: 1, caption: "Approved draft" }],
          captions_json: [{ start_ms: 0, end_ms: 4000, text: "Approved draft" }],
        } as unknown as T;
      }
      if (sql.includes("UPDATE video_scripts")) {
        return {
          id: "66666666-6666-4666-8666-666666666666",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          status: "approved",
        } as unknown as T;
      }
      if (sql.includes("SELECT id, project_id, content_draft_id, status") && sql.includes("FROM video_scripts")) {
        return {
          id: "66666666-6666-4666-8666-666666666666",
          project_id: null,
          content_draft_id: "00000000-0000-0000-0000-000000000010",
          status: draftStatus === "approved" ? "approved" : "draft",
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO video_jobs")) {
        return {
          id: "77777777-7777-4777-8777-777777777777",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          video_script_id: "66666666-6666-4666-8666-666666666666",
          template_key: "career-lesson-vertical",
          status: "queued",
          render_provider: "remotion",
          aspect_ratio: "9:16",
        } as unknown as T;
      }
      if (sql.includes("FROM video_jobs") && sql.includes("render_provider")) {
        return {
          id: "77777777-7777-4777-8777-777777777777",
          status: "queued",
          render_provider: "remotion",
          template_key: "career-lesson-vertical",
          aspect_ratio: "9:16",
          title: "Career Lesson",
          hook: "Turn your weekly work into proof",
          scenes_json: [{ order: 1, caption: "Turn your weekly work into proof", duration_seconds: 4 }],
          captions_json: [{ start_ms: 0, end_ms: 4000, text: "Turn your weekly work into proof" }],
        } as unknown as T;
      }
      if (sql.includes("UPDATE video_jobs")) {
        return {
          id: "77777777-7777-4777-8777-777777777777",
          status: "rendering",
          render_provider: "remotion",
        } as unknown as T;
      }
      if (sql.includes("UPDATE video_assets")) {
        return {
          id: "88888888-8888-4888-8888-888888888888",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          video_job_id: "77777777-7777-4777-8777-777777777777",
          file_name: "77777777-7777-4777-8777-777777777777.mp4",
          status: "approved",
        } as unknown as T;
      }
      if (sql.includes("FROM video_assets") && sql.includes("video_jobs.content_draft_id") && !sql.includes("content_drafts.id AS draft_id")) {
        return {
          id: "88888888-8888-4888-8888-888888888888",
          user_id: "00000000-0000-0000-0000-000000000001",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          video_job_id: "77777777-7777-4777-8777-777777777777",
          file_name: "77777777-7777-4777-8777-777777777777.mp4",
          mime_type: "video/mp4",
          storage_path: "/tmp/socialops-video-test/77777777-7777-4777-8777-777777777777.mp4",
          public_url: "https://media.example.com/77777777-7777-4777-8777-777777777777.mp4",
          duration_seconds: 4,
          width: 1080,
          height: 1920,
          status: "approved",
          content_draft_id: "00000000-0000-0000-0000-000000000010",
        } as unknown as T;
      }
      if (sql.includes("FROM video_assets") && sql.includes("video_post_bridges.id AS bridge_id")) {
        return {
          asset_id: "88888888-8888-4888-8888-888888888888",
          asset_status: "used",
          bridge_id: "99999999-9999-4999-8999-999999999999",
          draft_id: "00000000-0000-0000-0000-000000000010",
          project_id: null,
          mode: "builder",
          channel: "tiktok",
          type: "script",
          content: "Approved draft",
          draft_status: draftStatus,
          target_audience: "builders",
          purpose: "project update",
          source_note_ids_json: [],
          media_asset_ids_json: ["44444444-4444-4444-8444-444444444444"],
          claims_used_json: [],
          missing_info_json: [],
          risk_notes: "",
        } as unknown as T;
      }
      if (sql.includes("FROM video_assets") && sql.includes("video_scripts.title AS script_title")) {
        return {
          id: "88888888-8888-4888-8888-888888888888",
          file_name: "77777777-7777-4777-8777-777777777777.mp4",
          mime_type: "video/mp4",
          storage_path: "/tmp/socialops-video-test/77777777-7777-4777-8777-777777777777.mp4",
          public_url: "https://media.example.com/77777777-7777-4777-8777-777777777777.mp4",
          duration_seconds: 4,
          width: 1080,
          height: 1920,
          status: "approved",
          video_job_id: "77777777-7777-4777-8777-777777777777",
          draft_id: "00000000-0000-0000-0000-000000000010",
          draft_title: "Weekly update video seed",
          draft_hook: "Turn your weekly work into proof.",
          draft_content: "Approved draft",
          draft_channel: "tiktok",
          draft_type: "script",
          draft_status: draftStatus,
          draft_target_audience: "builders",
          draft_purpose: "weekly update video",
          script_title: "Career Lesson",
          script_hook: "Turn your weekly work into proof",
          script_platform: "tiktok",
          script_status: "approved",
          script_captions_json: [{ start_ms: 0, end_ms: 4000, text: "Turn your weekly work into proof" }],
        } as unknown as T;
      }
      if (sql.includes("INSERT INTO usage_events")) {
        return { id: "usage-1" } as unknown as T;
      }
      if (sql.includes("INSERT INTO personal_profiles")) {
        return {
          id: "profile-1",
          user_id: "00000000-0000-0000-0000-000000000001",
          name: "Arhan",
          headline: "Building SocialOps",
        } as unknown as T;
      }
      if (sql.includes("FROM content_drafts") && sql.includes("WHERE id = $1")) {
        return {
          id: "00000000-0000-0000-0000-000000000010",
          workspace_id: "00000000-0000-0000-0000-000000000020",
          project_id: null,
          mode: "builder",
          channel: "linkedin",
          type: "post",
          content: "Approved draft",
          status: draftStatus,
          target_audience: "builders",
          purpose: "project update",
          source_note_ids_json: [],
          media_asset_ids_json: [],
          claims_used_json: [],
          missing_info_json: [],
          risk_notes: "",
        } as unknown as T;
      }
      if (sql.includes("UPDATE content_drafts")) {
        return {
          id: "00000000-0000-0000-0000-000000000010",
          openpost_post_id: "op-post-1",
          status: "scheduled",
          media_asset_ids_json: ["44444444-4444-4444-8444-444444444444"],
        } as unknown as T;
      }
      return undefined;
    },
    async tx(fn) {
      return fn({
        query: async (sql: string) => {
          if (sql.includes("INSERT INTO content_drafts")) {
            return {
              rows: [
                {
                  id: "00000000-0000-0000-0000-000000000030",
                  status: "needs_review",
                  generated_by_ai: true,
                  content: "Generated from source-of-truth",
                },
              ],
            };
          }
          if (sql.includes("INSERT INTO visual_assets")) {
            return {
              rows: [
                {
                  id: "00000000-0000-0000-0000-000000000070",
                  status: "generating",
                  external_provider: "visual-worker",
                  external_job_id: "prompt-1",
                  prompt: "Clean LinkedIn carousel background",
                },
              ],
            };
          }
          if (sql.includes("INSERT INTO video_assets")) {
            return {
              rows: [
                {
                  id: "88888888-8888-4888-8888-888888888888",
                  workspace_id: "00000000-0000-0000-0000-000000000020",
                  video_job_id: "77777777-7777-4777-8777-777777777777",
                  file_name: "77777777-7777-4777-8777-777777777777.mp4",
                  status: "rendered",
                },
              ],
            };
          }
          if (sql.includes("INSERT INTO media_assets")) {
            return {
              rows: [
                {
                  id: "44444444-4444-4444-8444-444444444444",
                  workspace_id: "00000000-0000-0000-0000-000000000020",
                  source: "remotion",
                  media_kind: "video",
                  status: "approved",
                },
              ],
            };
          }
          if (sql.includes("UPDATE content_drafts")) {
            return {
              rows: [
                {
                  id: "00000000-0000-0000-0000-000000000010",
                  media_asset_ids_json: ["44444444-4444-4444-8444-444444444444"],
                },
              ],
            };
          }
          if (sql.includes("UPDATE decks")) {
            return {
              rows: [
                {
                  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                  workspace_id: "00000000-0000-0000-0000-000000000020",
                  title: "Career proof deck",
                  renderer: "marp",
                  status: sql.includes("export_url") ? "rendered" : "approved",
                  export_url: sql.includes("export_url") ? "https://media.example.com/career-proof.pdf" : null,
                },
              ],
            };
          }
          if (sql.includes("INSERT INTO approval_items")) {
            return { rows: [{ id: "approval-1" }] };
          }
          if (sql.includes("INSERT INTO video_post_bridges")) {
            return {
              rows: [
                {
                  id: "99999999-9999-4999-8999-999999999999",
                  video_asset_id: "88888888-8888-4888-8888-888888888888",
                  content_draft_id: "00000000-0000-0000-0000-000000000010",
                  status: "attached",
                },
              ],
            };
          }
          if (sql.includes("UPDATE video_post_bridges")) {
            return {
              rows: [
                {
                  id: "99999999-9999-4999-8999-999999999999",
                  video_asset_id: "88888888-8888-4888-8888-888888888888",
                  content_draft_id: "00000000-0000-0000-0000-000000000010",
                  openpost_post_id: "op-post-1",
                  status: "scheduled",
                },
              ],
            };
          }
          if (sql.includes("UPDATE video_assets")) {
            return {
              rows: [
                {
                  id: "88888888-8888-4888-8888-888888888888",
                  status: "used",
                },
              ],
            };
          }
          if (sql.includes("UPDATE video_jobs")) {
            return {
              rows: [
                {
                  id: "77777777-7777-4777-8777-777777777777",
                  status: "rendered",
                  duration_seconds: 4,
                },
              ],
            };
          }
          if (sql.includes("UPDATE visual_assets")) {
            return {
              rows: [
                {
                  id: "00000000-0000-0000-0000-000000000070",
                  workspace_id: "00000000-0000-0000-0000-000000000020",
                  status: "approved",
                },
              ],
            };
          }
          if (sql.includes("UPDATE outreach_messages")) {
            return {
              rows: [
                {
                  id: "cccc1111-1111-4111-8111-cccccccccccc",
                  workspace_id: "00000000-0000-0000-0000-000000000020",
                  status: "approved",
                },
              ],
            };
          }
          if (sql.includes("DELETE FROM product_demo_scenes")) {
            return { rows: [] };
          }
          if (sql.includes("INSERT INTO product_demo_scenes")) {
            return {
              rows: [
                {
                  id: "eeee9999-9999-4999-8999-eeeeeeeeeeee",
                  order: 1,
                  caption: "Hook",
                },
              ],
            };
          }
          if (sql.includes("UPDATE product_demo_scenes")) {
            return {
              rows: [
                {
                  id: "eeee9999-9999-4999-8999-eeeeeeeeeeee",
                  order: 1,
                  screenshot_asset_id: "44444444-4444-4444-8444-444444444444",
                },
              ],
            };
          }
          if (sql.includes("UPDATE product_demo_projects") && sql.includes("'rendered'")) {
            return {
              rows: [
                {
                  id: "dddd1111-1111-4111-8111-dddddddddddd",
                  status: "rendered",
                },
              ],
            };
          }
          if (sql.includes("UPDATE product_demo_projects") && sql.includes("'captured'")) {
            return {
              rows: [
                {
                  id: "dddd1111-1111-4111-8111-dddddddddddd",
                  status: "captured",
                },
              ],
            };
          }
          if (sql.includes("UPDATE product_demo_projects")) {
            return {
              rows: [
                {
                  id: "dddd1111-1111-4111-8111-dddddddddddd",
                  status: "planned",
                },
              ],
            };
          }
          if (sql.includes("INSERT INTO caption_tracks")) {
            return {
              rows: [
                {
                  id: "cap00001-0001-4001-8001-cccccccccccc",
                  format: "json",
                  content: { text: "captions" },
                },
              ],
            };
          }
          if (sql.includes("INSERT INTO caption_segments")) {
            return { rows: [{ id: "seg00001-0001-4001-8001-ssssssssssss" }] };
          }
          if (sql.includes("INSERT INTO visual_assets") && sql.includes("'broll'")) {
            return {
              rows: [
                {
                  id: "vis00001-0001-4001-8001-vvvvvvvvvvvv",
                  workspace_id: "00000000-0000-0000-0000-000000000020",
                  type: "broll",
                  media_kind: "video",
                  status: "generating",
                  external_provider: "higgsfield",
                  external_job_id: "hf-1",
                },
              ],
            };
          }
          return { rows: [{ id: "00000000-0000-0000-0000-000000000002" }] };
        },
      } as never);
    },
    async close() {},
  };
}

function createMockOpenPost(): OpenPostClient {
  return {
    createPost: vi.fn(async () => ({
      id: "op-post-1",
      status: "scheduled",
      approval_status: "approved",
    })),
  };
}

function createMockDeckWorker(): DeckWorkerClient {
  return {
    render: vi.fn(async (input) => ({
      deckId: input.deckId,
      renderer: input.renderer,
      format: input.format ?? "pdf",
      fileName: `${input.deckId}.pdf`,
      mimeType: "application/pdf" as const,
      storagePath: `/tmp/socialops-decks/${input.deckId}.pdf`,
      publicUrl: "https://media.example.com/career-proof.pdf",
    })),
  };
}

function createMockComfyUi(): ComfyUiClient {
  return {
    queuePrompt: vi.fn(async () => ({
      prompt_id: "prompt-1",
      number: 1,
    })),
    getHistory: vi.fn(async () => ({
      "prompt-1": {
        status: "running",
      },
    })),
  };
}

function createMockPokeeResearch(): PokeeResearchClient {
  return {
    search: vi.fn(async () => ({
      success: true,
      results: [
        {
          title: "API limits",
          url: "https://example.com/limits",
          snippet: "Platform APIs have limits that affect scheduling products.",
        },
      ],
    })),
    read: vi.fn(async () => ({
      success: true,
      url: "https://example.com/limits",
      summary: "Research summary",
    })),
  };
}

function createMockVisualWorker(): VisualWorkerClient {
  return {
    generate: vi.fn(async (input) => ({
      visualJobId: input.visualJobId,
      promptId: "prompt-1",
      status: "submitted" as const,
    })),
    poll: vi.fn(async (input) => ({
      visualJobId: input.visualJobId,
      promptId: input.promptId,
      status: "generated" as const,
      outputs: [
        {
          filename: "visual.png",
          mimeType: "image/png",
          storagePath: "/tmp/socialops-visuals/visual.png",
          publicUrl: "https://media.example.com/visual.png",
        },
      ],
    })),
  };
}

function createMockVideoWorker(): VideoWorkerClient {
  return {
    assemble: vi.fn(async (input) => ({
      videoJobId: input.videoJobId,
      status: "rendered" as const,
      fileName: `${input.videoJobId}.mp4`,
      mimeType: "video/mp4" as const,
      storagePath: `/tmp/socialops-video-test/${input.videoJobId}.mp4`,
      publicUrl: `https://media.example.com/${input.videoJobId}.mp4`,
      width: 1080,
      height: 1920,
      durationSeconds: 4,
      renderer: "ffmpeg" as const,
      postProcessor: "ffmpeg" as const,
      scenes: input.scenes.map((scene: VideoWorkerSceneInput, index: number) => ({
        order: scene.order ?? index + 1,
        sourceKind: scene.videoUrl || scene.videoPath
          ? ("video_file" as const)
          : scene.imageUrl || scene.imagePath
            ? ("image_kenburns" as const)
            : ("fallback_card" as const),
        durationSeconds: scene.durationSeconds ?? 4,
      })),
      captionsBurnedIn: Array.isArray(input.captions) && input.captions.length > 0,
    })),
    capture: vi.fn(async (input) => ({
      jobId: input.jobId,
      captures: input.scenes.map((scene: VideoWorkerCaptureScene) => ({
        order: scene.order,
        url: scene.url,
        mode: scene.mode,
        filePath: `/tmp/socialops-capture/${input.jobId}/scene-${scene.order}.${scene.mode === "screen_recording" ? "webm" : "png"}`,
        width: scene.viewport === "vertical_1080" ? 1080 : scene.viewport === "landscape_1920" ? 1920 : 1080,
        height: scene.viewport === "landscape_1920" ? 1080 : scene.viewport === "linkedin_1080" ? 1350 : scene.viewport === "square_1080" ? 1080 : 1920,
      })),
    })),
  };
}

function createMockWhisper(): WhisperClient {
  return {
    transcribe: vi.fn(async (input) => ({
      language: input.language ?? "en",
      text: "Turn your work into content.",
      segments: [
        { startMs: 0, endMs: 1500, text: "Turn your work" },
        { startMs: 1500, endMs: 3000, text: "into content." },
      ],
      model: input.model ?? "small.en",
      durationSeconds: 3,
    })),
  };
}

function createMockMiniClaw(): MiniClawClient {
  return {
    runSkill: vi.fn(async () => ({ scenes: [] })),
    planProductDemoScenes: vi.fn(async (input) => [
      {
        order: 1,
        url: input.product_url,
        action_description: `Open ${input.product_name}`,
        narration: `This is ${input.product_name}.`,
        caption: input.product_name,
        duration_seconds: 4,
      },
      {
        order: 2,
        url: input.product_url,
        action_description: "Run the core flow",
        narration: input.goal,
        caption: input.goal,
        duration_seconds: 6,
      },
      {
        order: 3,
        url: input.product_url,
        action_description: "Call to action",
        narration: `Try ${input.product_name}.`,
        caption: `Try ${input.product_name}`,
        duration_seconds: 4,
      },
    ]),
  };
}

function createMockVideoProviders(): VideoProviderRouter {
  const higgsfieldAdapter = {
    key: "higgsfield" as const,
    isReady: () => true,
    generate: vi.fn(async (input) => ({
      jobId: input.jobId,
      provider: "higgsfield" as const,
      status: "completed" as const,
      videoUrl: `https://media.example.com/broll/${input.jobId}.mp4`,
    })),
  };
  return {
    resolve: (preferred) => (preferred === "higgsfield" ? higgsfieldAdapter : higgsfieldAdapter),
    byKey: (key) => (key === "higgsfield" ? higgsfieldAdapter : undefined),
    list: () => [
      { key: "kling_ai", ready: false },
      { key: "hailuo_minimax", ready: false },
      { key: "replicate", ready: false },
      { key: "fal_ai", ready: false },
      { key: "huggingface_space", ready: false },
      { key: "higgsfield", ready: true },
      { key: "runway_gen3", ready: false },
      { key: "luma_dream", ready: false },
      { key: "pika", ready: false },
      { key: "comfyui_wan_i2v", ready: true },
      { key: "manual", ready: true },
    ],
  };
}

describe("SocialOps API routes", () => {
  it("exposes health without auth", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({ method: "GET", url: "/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("exposes source-of-truth metadata", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({ method: "GET", url: "/v1/meta" });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.product).toBe("SocialOps");
    expect(body.purpose).toContain("Local AI video and content");
    expect(body.content_modes).toContain("student");
    expect(body.source_of_truth_tables).toContain("content_drafts");
    expect(body.content_channels).toContain("threads");
    expect(body.content_channels).toContain("reddit");
    expect(body.target_platforms).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "x" }),
        expect.objectContaining({ key: "linkedin" }),
        expect.objectContaining({ key: "tiktok" }),
        expect.objectContaining({ key: "reddit" }),
      ]),
    );
    expect(body.source_of_truth_tables).toContain("brand_profiles");
    expect(body.source_of_truth_tables).toContain("ugc_briefs");
    expect(body.internal_algorithms).toContain("socialops-x-style-internal-v1");
    expect(body.comfy_media_kinds).toContain("voice");
    expect(body.media_runtime_profile).toBe("macbook_local");
    expect(body.allow_heavy_media_workflows).toBe(false);
    expect(body.comfy_workflow_presets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "short-video-frame-set",
          mediaKind: "video",
        }),
        expect.objectContaining({
          key: "higgsfield-style-trend-ad",
          mediaKind: "video",
        }),
      ]),
    );
    expect(body.video_provider_statuses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "comfyui_wan" }),
        expect.objectContaining({ key: "pippit" }),
      ]),
    );
    expect(body.professional_video_templates).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "founder-diligence-story" })]),
    );
  });

  it("describes the connected local AI content engine purpose", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({ method: "GET", url: "/v1/content-engine/purpose" });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.foundations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "pokee" }),
        expect.objectContaining({ key: "claw" }),
        expect.objectContaining({ key: "comfyui" }),
        expect.objectContaining({ key: "x_algorithm" }),
        expect.objectContaining({ key: "postiz" }),
      ]),
    );
    expect(body.platforms).toEqual(expect.arrayContaining([expect.objectContaining({ key: "reddit" })]));
    expect(body.automationModel.planning).toBe("automated");
  });

  it("describes default local UGC, AI video, and product-demo pipelines", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({ method: "GET", url: "/v1/content-engine/video-pipelines" });
    const body = response.json();

    expect(response.statusCode).toBe(200);
    expect(body.pipelines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "ugc" }),
        expect.objectContaining({ kind: "ai_video" }),
        expect.objectContaining({ kind: "product_demo" }),
      ]),
    );
    expect(body.pipelines[0].engine).toEqual(
      expect.objectContaining({
        research: "pokee",
        ai: "miniclaw",
        visuals: "comfyui",
        ranking: "x-algorithm",
      }),
    );
    expect(body.pipelines[0].engine.providerRouter).toContain("remotion_ffmpeg");
    expect(body.pipelines[0].creativeStandard.avoid).toContain("single-card slideshow videos");
  });

  it("exposes professional video provider capabilities and templates", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const providers = await app.inject({ method: "GET", url: "/v1/content-engine/video-providers" });
    const templates = await app.inject({ method: "GET", url: "/v1/content-engine/video-templates" });

    expect(providers.statusCode).toBe(200);
    expect(providers.json().providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "comfyui_wan", workflowPresetKeys: ["wan-i2v-broll"] }),
        expect.objectContaining({ key: "seedance", workflowPresetKeys: ["seedance-director-i2v"] }),
      ]),
    );
    expect(templates.statusCode).toBe(200);
    expect(templates.json().templates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "ugc-founder-problem" }),
        expect.objectContaining({ key: "product-demo-proof" }),
        expect.objectContaining({ key: "tiktok-native-hook" }),
      ]),
    );
  });

  it("builds a workspace-specific multi-platform content engine plan", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/content-engine/plan",
      payload: {
        platforms: ["x", "linkedin", "tiktok", "reddit"],
        account_count_by_platform: {
          x: 3,
          linkedin: 1,
          tiktok: 2,
          reddit: 1,
        },
        objective: "Generate, rank, schedule, post, and analyze Arhan's AI video/content across every social platform.",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        objective: expect.stringContaining("Generate, rank"),
        platforms: expect.arrayContaining([
          expect.objectContaining({ key: "x", configuredAccountCount: 3, needsAccountConnection: false }),
          expect.objectContaining({ key: "reddit", configuredAccountCount: 1, needsAccountConnection: false }),
        ]),
      }),
    );
  });

  it("builds a workspace-specific local product video pipeline", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/content-engine/video-pipeline",
      payload: {
        kind: "product_demo",
        title: "VCPeer local product demo",
        product_or_project: "VCPeer",
        target_audience: "developers building with agents",
        objective: "Show the real VCPeer workflow and convert it into X, LinkedIn, TikTok, and Reddit content.",
        platforms: ["x", "linkedin", "tiktok", "reddit"],
        source_facts: ["VCPeer uses real terminal and agent workflow screenshots."],
        real_screen_asset_ids: ["screen-recording-1"],
        include_ai_broll: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        kind: "product_demo",
        render: expect.objectContaining({
          templateKey: "product-demo",
          renderer: "remotion",
          postProcessor: "ffmpeg",
        }),
        distribution: expect.arrayContaining([
          expect.objectContaining({ platform: "x" }),
          expect.objectContaining({ platform: "reddit" }),
        ]),
        safeguards: expect.arrayContaining(["Use real screen recordings or screenshots for product UI."]),
      }),
    );
  });

  it("builds a professional VCPeer provider-routed video plan", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/content-engine/professional-video-plan",
      payload: {
        kind: "product_demo",
        template_key: "founder-diligence-story",
        product_or_project: "VCPeer",
        product_url: "https://vcpeer.com",
        target_audience: "startup founders raising capital",
        objective: "Create a founder diligence video with real VCPeer proof and ComfyUI support b-roll.",
        screenshots: ["vcpeer-home.png"],
        screen_recordings: ["vcpeer-search-flow.mp4"],
      },
    });

    const body = response.json();
    expect(response.statusCode).toBe(200);
    expect(body.architecture).toEqual(
      expect.arrayContaining(["Pokee research", "provider router", "Remotion/FFmpeg final edit"]),
    );
    expect(body.template).toEqual(expect.objectContaining({ key: "founder-diligence-story" }));
    expect(body.providerOrder).toContain("comfyui_wan");
    expect(body.providerOrder).toContain("remotion_ffmpeg");
    expect(body.providerOrder).not.toContain("higgsfield");
    expect(body.providerOrder).not.toContain("pippit");
    expect(body.comfyClipJobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          workflowKey: "wan-i2v-broll",
          width: 1080,
          height: 1920,
          queueNow: false,
        }),
      ]),
    );
    expect(body.generatedClipPlan).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          providerKey: expect.any(String),
          prompt: expect.stringContaining("VCPeer"),
        }),
      ]),
    );
    expect(body.blockedReasons).toEqual(expect.arrayContaining([expect.stringContaining("approval required")]));
    expect(body.publishing).toEqual(expect.objectContaining({ handoff: "openpost_postiz_or_manual" }));
  });

  it("requires auth headers in production", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: true });

    const response = await app.inject({ method: "GET", url: "/v1/workspaces" });

    expect(response.statusCode).toBe(403);
  });

  it("upserts the personal profile for the authenticated user", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/profile",
      payload: {
        name: "Arhan",
        headline: "Building SocialOps",
        skills_json: ["SQL", "Power BI", "product"],
        platforms_json: ["linkedin", "x"],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().headline).toBe("Building SocialOps");
  });

  it("upserts a company brand profile for a workspace", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({
      method: "PUT",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/brand",
      payload: {
        name: "SocialOps",
        company_name: "SocialOps",
        industry: "creator software",
        platforms_json: ["linkedin", "x", "tiktok"],
        proof_points_json: ["turns real work into content"],
        forbidden_claims_json: ["guaranteed follower growth"],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        company_name: "SocialOps",
      }),
    );
  });

  it("creates agency clients, campaigns, media assets, and UGC briefs", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const client = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/clients",
      payload: {
        name: "Beta Client",
        industry: "SaaS",
        content_pillars_json: ["founder story", "product education"],
      },
    });
    expect(client.statusCode).toBe(200);
    expect(client.json().slug).toBe("beta-client");

    const campaign = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/campaigns",
      payload: {
        agency_client_id: "22222222-2222-4222-8222-222222222222",
        name: "Launch campaign",
        objective: "Generate approved launch content",
        status: "active",
        platforms_json: ["linkedin", "instagram", "tiktok"],
      },
    });
    expect(campaign.statusCode).toBe(200);
    expect(campaign.json().status).toBe("active");

    const media = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/media-assets",
      payload: {
        campaign_id: "33333333-3333-4333-8333-333333333333",
        source: "external",
        media_kind: "video",
        title: "Founder UGC clip",
        url: "https://assets.example.com/founder-ugc.mp4",
        status: "approved",
      },
    });
    expect(media.statusCode).toBe(200);
    expect(media.json().media_kind).toBe("video");

    const ugcBrief = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/ugc-briefs",
      payload: {
        campaign_id: "33333333-3333-4333-8333-333333333333",
        title: "UGC launch brief",
        product_or_offer: "SocialOps setup",
        platforms_json: ["tiktok", "instagram", "youtube_shorts"],
        hooks_json: ["Stop posting random content"],
        talking_points_json: ["Capture real work", "Approve before posting"],
        do_not_say_json: ["guaranteed virality"],
        status: "needs_review",
      },
    });
    expect(ugcBrief.statusCode).toBe(200);
    expect(ugcBrief.json().status).toBe("needs_review");
  });

  it("generates UGC script drafts and attaches approved media to drafts", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const generated = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/ugc-briefs/55555555-5555-4555-8555-555555555555/generate-drafts",
      payload: {
        channels: ["tiktok", "instagram"],
      },
    });
    expect(generated.statusCode).toBe(200);
    expect(generated.json().drafts).toHaveLength(2);

    const attached = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/content-drafts/00000000-0000-0000-0000-000000000010/media-assets",
      payload: {
        media_asset_ids: ["44444444-4444-4444-8444-444444444444"],
      },
    });
    expect(attached.statusCode).toBe(200);
    expect(attached.json().media_asset_ids_json).toContain("44444444-4444-4444-8444-444444444444");
  });

  it("syncs only approved drafts to OpenPost", async () => {
    const openPost = createMockOpenPost();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb({ draftStatus: "approved" }), openPost, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/content-drafts/00000000-0000-0000-0000-000000000010/openpost",
      payload: {
        openpost_workspace_id: "openpost-workspace-1",
        openpost_user_id: "openpost-user-1",
        social_account_ids: ["social-account-1"],
        scheduled_at: "2026-05-20T09:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(openPost.createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "openpost-workspace-1",
        sourceDraftId: "00000000-0000-0000-0000-000000000010",
        scheduledAt: "2026-05-20T09:00:00.000Z",
      }),
    );
  });

  it("blocks unapproved drafts from OpenPost sync", async () => {
    const openPost = createMockOpenPost();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb({ draftStatus: "needs_review" }), openPost, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/content-drafts/00000000-0000-0000-0000-000000000010/openpost",
      payload: {
        openpost_workspace_id: "openpost-workspace-1",
        openpost_user_id: "openpost-user-1",
        social_account_ids: ["social-account-1"],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(openPost.createPost).not.toHaveBeenCalled();
  });

  it("generates a review draft from source-of-truth notes", async () => {
    const db = createMockDb({
      notes: [
          {
            id: "00000000-0000-0000-0000-000000000040",
            type: "weekly_update",
            content: "This week I connected SocialOps drafts to OpenPost approval flow.",
            created_at: "2026-05-16T12:00:00.000Z",
          },
        ],
    });

    const app = fastify();
    await registerRoutes(app, { db, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/generate-draft",
      payload: {
        mode: "builder",
        channel: "linkedin",
        type: "post",
        purpose: "project update",
        target_audience: "builders",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        status: "needs_review",
        generated_by_ai: true,
      }),
    );
  });

  it("ranks draft candidates through x-algorithm signals", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/content-drafts/rank-x",
      payload: {
        preferred_topics: ["vcpeer", "product workflow", "distribution"],
        muted_topics: ["generic"],
        preferred_channels: ["x"],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        algorithm: "socialops-x-style-internal-v1",
        ranked: expect.any(Array),
      }),
    );
    expect(response.json().ranked[0]).toEqual(
      expect.objectContaining({
        candidate: expect.objectContaining({
          id: "11111111-1111-4111-8111-111111111111",
        }),
        components: expect.objectContaining({
          affinity: expect.any(Number),
          engagement: expect.any(Number),
        }),
      }),
    );
  });

  it("queues ComfyUI visual assets as a separate service", async () => {
    const visualWorker = createMockVisualWorker();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), visualWorker, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/visuals",
      payload: {
        content_draft_id: "11111111-1111-4111-8111-111111111111",
        type: "linkedin_carousel_background",
        prompt: "Clean LinkedIn carousel background",
        workflow_key: "linkedin-carousel-background",
        workflow_json: {
          "6": {
            class_type: "CLIPTextEncode",
            inputs: {
              text: "Clean LinkedIn carousel background",
            },
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(visualWorker.generate).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "linkedin-carousel-background",
        prompt: "Clean LinkedIn carousel background",
      }),
    );
    expect(response.json()).toEqual(
      expect.objectContaining({
        status: "generating",
        external_provider: "visual-worker",
        external_job_id: "prompt-1",
      }),
    );
  });

  it("blocks unapproved ComfyUI workflow keys", async () => {
    const comfyUi = createMockComfyUi();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), comfyUi, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/visuals",
      payload: {
        type: "voiceover_audio",
        prompt: "Narrate this approved short-form script",
        workflow_key: "random-node-from-internet",
        workflow_json: {
          "1": {
            class_type: "SomeVoiceNode",
            inputs: {},
          },
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(comfyUi.queuePrompt).not.toHaveBeenCalled();
  });

  it("blocks heavy ComfyUI workflows on the MacBook local profile", async () => {
    const comfyUi = createMockComfyUi();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), comfyUi, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/visuals",
      payload: {
        type: "short_video_frame_set",
        prompt: "Generate frames for a short-form product update",
        workflow_key: "short-video-frame-set",
        workflow_json: {
          "1": {
            class_type: "VideoGenerationNode",
            inputs: {},
          },
        },
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("current media runtime profile is macbook_local");
    expect(comfyUi.queuePrompt).not.toHaveBeenCalled();
  });

  it("stores heavy ComfyUI workflows as drafts on MacBook local profile", async () => {
    const comfyUi = createMockComfyUi();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), comfyUi, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/visuals",
      payload: {
        type: "short_video_frame_set",
        prompt: "Generate frames for a short-form product update",
        workflow_key: "short-video-frame-set",
        queue_now: false,
        workflow_json: {
          "1": {
            class_type: "VideoGenerationNode",
            inputs: {},
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(comfyUi.queuePrompt).not.toHaveBeenCalled();
  });

  it("polls visual-worker output and marks visual assets as generated", async () => {
    const visualWorker = createMockVisualWorker();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), visualWorker, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/visuals/00000000-0000-0000-0000-000000000070/poll",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(visualWorker.poll).toHaveBeenCalledWith({
      visualJobId: "00000000-0000-0000-0000-000000000070",
      promptId: "prompt-1",
    });
    expect(response.json()).toEqual(
      expect.objectContaining({
        asset: expect.objectContaining({
          status: "generated",
          output_url: "https://media.example.com/visual.png",
        }),
        poll: expect.objectContaining({
          status: "generated",
        }),
      }),
    );
  });

  it("generates an approval-first video script from a content draft", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/script",
      payload: {
        content_draft_id: "11111111-1111-4111-8111-111111111111",
        platform: "tiktok",
        mode: "project",
        video_type: "career_lesson_vertical",
        duration_seconds: 30,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        status: "draft",
        platform: "tiktok",
        mode: "project",
      }),
    );
    expect(response.json().scenes_json.length).toBeGreaterThan(0);
  });

  it("requires script approval before creating a video render job", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb({ draftStatus: "needs_review" }), production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/jobs",
      payload: {
        video_script_id: "66666666-6666-4666-8666-666666666666",
        template_key: "career-lesson-vertical",
        render_provider: "remotion",
        aspect_ratio: "9:16",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("video script must be approved");
  });

  it("queues an approved video script for Remotion rendering", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb({ draftStatus: "approved" }), production: false });

    const created = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/jobs",
      payload: {
        video_script_id: "66666666-6666-4666-8666-666666666666",
        template_key: "career-lesson-vertical",
        render_provider: "remotion",
        aspect_ratio: "9:16",
      },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json().status).toBe("queued");

    const render = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/jobs/77777777-7777-4777-8777-777777777777/render",
      payload: {},
    });
    expect(render.statusCode).toBe(200);
    expect(render.json().status).toBe("rendering");
  });

  it("renders an approved video job through the video worker and stores the asset", async () => {
    const videoWorker = createMockVideoWorker();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb({ draftStatus: "approved" }), videoWorker, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/jobs/77777777-7777-4777-8777-777777777777/render",
      payload: {},
    });

    expect(response.statusCode).toBe(200);
    expect(videoWorker.assemble).toHaveBeenCalledWith(
      expect.objectContaining({
        videoJobId: "77777777-7777-4777-8777-777777777777",
        aspectRatio: "9:16",
        scenes: expect.any(Array),
      }),
    );
    expect(response.json()).toEqual(
      expect.objectContaining({
        asset: expect.objectContaining({
          status: "rendered",
        }),
        job: expect.objectContaining({
          status: "rendered",
        }),
      }),
    );
  });

  it("approves and attaches rendered video assets to content drafts", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb({ draftStatus: "approved" }), production: false });

    const approved = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/assets/88888888-8888-4888-8888-888888888888/approval",
      payload: { action: "approve" },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().status).toBe("approved");

    const attached = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/assets/88888888-8888-4888-8888-888888888888/attach-to-draft",
      payload: {},
    });
    expect(attached.statusCode).toBe(200);
    expect(attached.json()).toEqual(
      expect.objectContaining({
        media_asset: expect.objectContaining({
          source: "remotion",
          media_kind: "video",
        }),
        bridge: expect.objectContaining({
          status: "attached",
        }),
        video_asset: expect.objectContaining({
          status: "used",
        }),
      }),
    );
  });

  it("builds a manual video export package with approval readiness", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb({ draftStatus: "approved" }), production: false });

    const response = await app.inject({
      method: "GET",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/assets/88888888-8888-4888-8888-888888888888/export-package",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        post_copy: "Approved draft",
        caption_text: "Turn your weekly work into proof",
        manual_upload: expect.objectContaining({
          platform: "tiktok",
          ready: true,
          required: true,
          blocked_by: [],
        }),
        compliance: expect.objectContaining({
          human_approval_required: true,
          no_auto_posting: true,
        }),
      }),
    );
  });

  it("sends approved attached video assets to OpenPost through the scheduler bridge", async () => {
    const openPost = createMockOpenPost();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb({ draftStatus: "approved" }), openPost, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/assets/88888888-8888-4888-8888-888888888888/send-to-openpost",
      payload: {
        openpost_workspace_id: "op-workspace-1",
        openpost_user_id: "op-user-1",
        social_account_ids: ["account-1"],
        scheduled_at: "2026-05-18T09:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(openPost.createPost).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: "op-workspace-1",
        userId: "op-user-1",
        sourceDraftId: "00000000-0000-0000-0000-000000000010",
        mediaAssetIds: ["44444444-4444-4444-8444-444444444444"],
        scheduledAt: "2026-05-18T09:00:00.000Z",
      }),
    );
    expect(response.json()).toEqual(
      expect.objectContaining({
        bridge: expect.objectContaining({
          openpost_post_id: "op-post-1",
          status: "scheduled",
        }),
      }),
    );
  });

  it("creates, approves, and renders decks through the Marp/Slidev deck worker", async () => {
    const deckWorker = createMockDeckWorker();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb({ draftStatus: "approved" }), deckWorker, production: false });

    const created = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/decks",
      payload: {
        type: "career_portfolio",
        title: "Career proof deck",
        renderer: "marp",
        status: "needs_review",
        markdown: "---\nmarp: true\n---\n# Career proof deck",
      },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toEqual(
      expect.objectContaining({
        renderer: "marp",
        status: "needs_review",
      }),
    );

    const approved = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/decks/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/approval",
      payload: { action: "approve" },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().status).toBe("approved");

    const rendered = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/decks/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/render",
      payload: { format: "pdf", dry_run: true },
    });
    expect(rendered.statusCode).toBe(200);
    expect(deckWorker.render).toHaveBeenCalledWith(
      expect.objectContaining({
        deckId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        renderer: "marp",
        format: "pdf",
        dryRun: true,
      }),
    );
    expect(rendered.json()).toEqual(
      expect.objectContaining({
        deck: expect.objectContaining({
          status: "rendered",
          export_url: "https://media.example.com/career-proof.pdf",
        }),
        render: expect.objectContaining({
          publicUrl: "https://media.example.com/career-proof.pdf",
        }),
      }),
    );
  });

  it("creates PokeeResearch-backed research briefs", async () => {
    const pokeeResearch = createMockPokeeResearch();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), pokeeResearch, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/research-briefs",
      payload: {
        topic: "social media scheduling API limits",
        question: "What limits should SocialOps explain to users?",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(pokeeResearch.search).toHaveBeenCalledWith(
      "social media scheduling API limits: What limits should SocialOps explain to users?",
    );
    expect(pokeeResearch.read).toHaveBeenCalledWith("https://example.com/limits", "What limits should SocialOps explain to users?");
    expect(response.json()).toEqual(
      expect.objectContaining({
        status: "needs_review",
        summary: "Research summary",
      }),
    );
  });

  it("approves a visual asset and writes an approval_items row", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/visuals/00000000-0000-0000-0000-000000000070/approval",
      payload: { action: "approve", reviewer_note: "Looks on-brand." },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        id: "00000000-0000-0000-0000-000000000070",
        status: "approved",
      }),
    );
  });

  it("creates an application and lists its answers", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const created = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/applications",
      payload: { name: "YC W27", type: "accelerator" },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toEqual(expect.objectContaining({ type: "accelerator", status: "draft" }));

    const answer = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/applications/aaaa1111-1111-4111-8111-aaaaaaaaaaaa/answers",
      payload: { question: "Why now?", answer: "Because the workflow is real." },
    });
    expect(answer.statusCode).toBe(200);
    expect(answer.json()).toEqual(
      expect.objectContaining({
        application_id: "aaaa1111-1111-4111-8111-aaaaaaaaaaaa",
        question: "Why now?",
      }),
    );

    const list = await app.inject({
      method: "GET",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/applications/aaaa1111-1111-4111-8111-aaaaaaaaaaaa/answers",
    });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toEqual([
      expect.objectContaining({ question: "Why now?", status: "draft" }),
    ]);
  });

  it("rejects application answers for unknown applications", async () => {
    const app = fastify();
    const db = createMockDb();
    // Override SELECT id FROM applications to return null
    const original = db.one;
    db.one = (async (sql: string, params?: unknown[]) => {
      if (sql.includes("SELECT id FROM applications")) {
        return undefined;
      }
      return original.call(db, sql, params ?? []);
    }) as typeof db.one;

    await registerRoutes(app, { db, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/applications/bbbb1111-1111-4111-8111-bbbbbbbbbbbb/answers",
      payload: { question: "Q?", answer: "A." },
    });
    expect(response.statusCode).toBe(404);
  });

  it("creates and updates a lead status", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const created = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/leads",
      payload: { name: "Lead Alpha", segment: "founder" },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toEqual(expect.objectContaining({ name: "Lead Alpha", status: "new" }));

    const updated = await app.inject({
      method: "PATCH",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/leads/bbbb1111-1111-4111-8111-bbbbbbbbbbbb",
      payload: { status: "contacted" },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json()).toEqual(expect.objectContaining({ status: "contacted" }));
  });

  it("rejects lead updates with no fields", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({
      method: "PATCH",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/leads/bbbb1111-1111-4111-8111-bbbbbbbbbbbb",
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it("creates, approves, and manually marks an outreach message sent", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const created = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/outreach-messages",
      payload: {
        lead_id: "bbbb1111-1111-4111-8111-bbbbbbbbbbbb",
        channel: "linkedin",
        body: "Hi, saw your post about SocialOps.",
      },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toEqual(expect.objectContaining({ channel: "linkedin", status: "draft" }));

    const approved = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/outreach-messages/cccc1111-1111-4111-8111-cccccccccccc/approval",
      payload: { action: "approve" },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json()).toEqual(expect.objectContaining({ status: "approved" }));

    const sent = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/outreach-messages/cccc1111-1111-4111-8111-cccccccccccc/manual-sent",
      payload: { sent_at: "2026-05-26T12:00:00.000Z" },
    });
    expect(sent.statusCode).toBe(200);
    expect(sent.json()).toEqual(expect.objectContaining({ status: "sent" }));
  });

  it("plans, captures, and renders a product demo end-to-end", async () => {
    const videoWorker = createMockVideoWorker();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb({ draftStatus: "approved" }), videoWorker, production: false });

    const created = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/product-demo/create",
      payload: {
        product_name: "VCPeer Terminal",
        product_url: "https://vcpeer.local/terminal",
        goal: "Show how the terminal answers an investor question.",
        platform: "linkedin",
      },
    });
    expect(created.statusCode).toBe(200);
    expect(created.json()).toEqual(
      expect.objectContaining({ product_name: "VCPeer Terminal", status: "planning" }),
    );

    const planned = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/product-demo/dddd1111-1111-4111-8111-dddddddddddd/plan",
      payload: {},
    });
    expect(planned.statusCode).toBe(200);
    expect(planned.json()).toEqual(
      expect.objectContaining({
        demo: expect.objectContaining({ status: "planned" }),
        scenes: expect.any(Array),
      }),
    );

    const captured = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/product-demo/dddd1111-1111-4111-8111-dddddddddddd/capture",
      payload: { mode: "screenshot", viewport: "linkedin_1080" },
    });
    expect(captured.statusCode).toBe(200);
    expect(videoWorker.capture).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "dddd1111-1111-4111-8111-dddddddddddd",
        scenes: expect.arrayContaining([
          expect.objectContaining({ order: 1, viewport: "linkedin_1080", mode: "screenshot" }),
        ]),
      }),
    );
    expect(captured.json()).toEqual(
      expect.objectContaining({
        demo: expect.objectContaining({ status: "captured" }),
      }),
    );

    const rendered = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/product-demo/dddd1111-1111-4111-8111-dddddddddddd/render",
      payload: { aspect_ratio: "9:16" },
    });
    expect(rendered.statusCode).toBe(200);
    expect(videoWorker.assemble).toHaveBeenCalledWith(
      expect.objectContaining({
        aspectRatio: "9:16",
        scenes: expect.arrayContaining([
          expect.objectContaining({
            order: 1,
            imagePath: expect.stringContaining("scene-1.png"),
          }),
        ]),
      }),
    );
    expect(rendered.json()).toEqual(
      expect.objectContaining({
        demo: expect.objectContaining({ status: "rendered" }),
        asset: expect.objectContaining({ status: "rendered" }),
      }),
    );
  });

  it("returns 400 from the presign route when storage is not configured", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });
    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/uploads/presign",
      payload: { file_name: "x.mp4", content_type: "video/mp4" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("presigns an R2 upload URL when storage is configured", async () => {
    const storage = createStorageClient({
      kind: "r2",
      bucket: "socialops-media",
      endpoint: "abc123.r2.cloudflarestorage.com",
      region: "auto",
      accessKeyId: "AKIAEXAMPLE",
      secretAccessKey: "secret",
      publicBaseUrl: "https://pub-xyz.r2.dev",
    });
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), storage, production: false });
    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/uploads/presign",
      payload: { file_name: "vcpeer demo.mp4", content_type: "video/mp4" },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.upload_url).toContain("X-Amz-Signature=");
    expect(body.public_url).toMatch(/^https:\/\/pub-xyz\.r2\.dev\/workspaces\/00000000-0000-0000-0000-000000000020\/uploads\/[0-9a-f-]+\/vcpeer_demo\.mp4$/u);
    expect(body.required_headers["content-type"]).toBe("video/mp4");
  });

  it("registers a people-video upload and rejects non-real-user uploads without consent", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const ok = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/people/upload",
      payload: {
        url: "https://media.example.com/uploads/clip.mp4",
        file_name: "clip.mp4",
        mime_type: "video/mp4",
        media_kind: "video",
        is_real_user: true,
      },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual(expect.objectContaining({ source: "upload", media_kind: "video" }));

    const blocked = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/people/upload",
      payload: {
        url: "https://media.example.com/uploads/clip2.mp4",
        file_name: "clip2.mp4",
        mime_type: "video/mp4",
        media_kind: "video",
        is_real_user: false,
      },
    });
    expect(blocked.statusCode).toBe(400);
  });

  it("transcribes a people-video upload through Whisper and stores captions", async () => {
    const whisper = createMockWhisper();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), whisper, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/people/transcribe",
      payload: { media_asset_id: "55551111-1111-4111-8111-555555555555", model: "small.en" },
    });
    expect(response.statusCode).toBe(200);
    expect(whisper.transcribe).toHaveBeenCalledWith(
      expect.objectContaining({ audioUrl: "https://media.example.com/uploads/clip.mp4", model: "small.en" }),
    );
    expect(response.json()).toEqual(
      expect.objectContaining({
        language: "en",
        model: "small.en",
        segments: expect.any(Array),
      }),
    );
  });

  it("returns an edit plan with the FTC compliance flags for a people video", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/people/edit",
      payload: { media_asset_id: "55551111-1111-4111-8111-555555555555", target_duration_seconds: 45 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        target_duration_seconds: 45,
        suggested_scenes: expect.any(Array),
        compliance: expect.objectContaining({
          ftc_fake_testimonial_rule: true,
          no_cloned_voice_without_consent: true,
        }),
      }),
    );
  });

  it("renders a people video through the FFmpeg assembler from uploaded footage", async () => {
    const videoWorker = createMockVideoWorker();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb({ draftStatus: "approved" }), videoWorker, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/people/render",
      payload: {
        media_asset_id: "55551111-1111-4111-8111-555555555555",
        aspect_ratio: "9:16",
        hook: "What changed this week",
        scenes: [
          { order: 1, start_seconds: 0, end_seconds: 3, caption: "Hook" },
          { order: 2, start_seconds: 3, end_seconds: 18, caption: "What changed" },
          { order: 3, start_seconds: 18, end_seconds: 30, caption: "CTA" },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(videoWorker.assemble).toHaveBeenCalledWith(
      expect.objectContaining({
        aspectRatio: "9:16",
        scenes: expect.arrayContaining([
          expect.objectContaining({ order: 1, videoUrl: "https://media.example.com/uploads/clip.mp4" }),
        ]),
      }),
    );
    expect(response.json()).toEqual(
      expect.objectContaining({
        asset: expect.objectContaining({ status: "rendered" }),
      }),
    );
  });

  it("uses MiniClaw to plan product-demo scenes when configured", async () => {
    const miniClaw = createMockMiniClaw();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), miniClaw, production: false });

    const planned = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/product-demo/dddd1111-1111-4111-8111-dddddddddddd/plan",
      payload: {},
    });
    expect(planned.statusCode).toBe(200);
    expect(miniClaw.planProductDemoScenes).toHaveBeenCalledWith(
      expect.objectContaining({ product_name: "VCPeer Terminal" }),
    );
    expect(planned.json()).toEqual(
      expect.objectContaining({
        planner_used: "miniclaw",
        demo: expect.objectContaining({ status: "planned" }),
      }),
    );
  });

  it("lists Higgsfield-style motion presets and provider readiness", async () => {
    const app = fastify();
    await registerRoutes(app, {
      db: createMockDb(),
      videoProviders: createMockVideoProviders(),
      production: false,
    });

    const response = await app.inject({ method: "GET", url: "/v1/videos/motion-presets" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.presets).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ key: "crash_zoom" }),
        expect.objectContaining({ key: "robo_arm_reveal" }),
        expect.objectContaining({ key: "vortex_pull" }),
      ]),
    );
    expect(body.providers).toEqual(
      expect.arrayContaining([expect.objectContaining({ key: "higgsfield", ready: true })]),
    );
  });

  it("generates a Higgsfield-style broll clip via the chosen motion preset + provider", async () => {
    const videoProviders = createMockVideoProviders();
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), videoProviders, production: false });

    const response = await app.inject({
      method: "POST",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/videos/broll/generate",
      payload: {
        source_image_url: "https://media.example.com/product/hero.jpg",
        prompt: "VCPeer terminal product hero shot",
        motion_preset: "crash_zoom",
        provider: "higgsfield",
        aspect_ratio: "9:16",
        duration_seconds: 4,
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual(
      expect.objectContaining({
        provider: "higgsfield",
        status: "completed",
        video_url: expect.stringContaining(".mp4"),
        preset: expect.objectContaining({ key: "crash_zoom" }),
      }),
    );
  });

  it("merges scheduled calendar items and scheduled drafts in a unified calendar view", async () => {
    const app = fastify();
    await registerRoutes(app, { db: createMockDb(), production: false });

    const response = await app.inject({
      method: "GET",
      url: "/v1/workspaces/00000000-0000-0000-0000-000000000020/calendar?from=2026-05-01T00:00:00.000Z&to=2026-07-01T00:00:00.000Z",
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.counts).toEqual({ calendar_items: 1, scheduled_drafts: 1, total: 2 });
    expect(body.items).toEqual([
      expect.objectContaining({
        kind: "calendar_item",
        platform: "linkedin",
        scheduled_for: "2026-06-01T10:00:00.000Z",
      }),
      expect.objectContaining({
        kind: "scheduled_draft",
        channel: "x",
        scheduled_for: "2026-06-02T15:00:00.000Z",
        openpost_post_id: "op-post-2",
      }),
    ]);
  });
});
