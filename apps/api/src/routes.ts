import { randomUUID } from "node:crypto";

import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";

import { canMarkManuallyPublished } from "@socialops/content/policy";
import { contentChannels, contentModes, contentStatuses, videoAspectRatios, videoRenderProviders } from "@socialops/core/models";
import { sourceOfTruthTables } from "@socialops/db/schema";
import { planEntitlements, type PlanKey } from "@socialops/billing/plans";
import { canTransitionContent } from "@socialops/approvals/transitions";
import { createContentEnginePlan, socialOpsPurpose, targetPlatforms, type TargetPlatformKey } from "@socialops/content-engine/purpose";
import { createDefaultLocalVideoPlans, createLocalVideoPipelinePlan, localVideoKinds, localVideoPlatforms } from "@socialops/content-engine/video-pipeline";
import {
  createProfessionalVideoProviderPlan,
  listVideoProviderStatuses,
  professionalVideoTemplateKeys,
  professionalVideoTemplates,
} from "@socialops/content-engine/video-providers";
import {
  canQueueComfyPreset,
  comfyMediaKinds,
  comfyWorkflowPresets,
  getComfyWorkflowPreset,
  inferComfyMediaKind,
  type SocialOpsMediaRuntimeProfile,
} from "@socialops/integrations/comfy-presets";
import type { ComfyUiClient } from "@socialops/integrations/comfyui";
import type { PokeeResearchClient, PokeeSearchResultItem } from "@socialops/integrations/pokee";
import { rankXStyleCandidates } from "@socialops/x-algorithm/ranking";

import type { AuthUser } from "./auth.js";
import type { DeckWorkerClient } from "./deck-worker.js";
import { requireWorkspaceRole, resolveDevAuthUser } from "./auth.js";
import type { Db } from "./db.js";
import { badRequest, notFound } from "./errors.js";
import type { IdentityProvider } from "./identity.js";
import type { MiniClawClient, MiniClawProductDemoScene } from "./miniclaw.js";
import { listMotionPresets, getMotionPreset } from "./motion-presets.js";
import type { StorageClient } from "./storage.js";
import type { VideoProviderRouter } from "./video-providers.js";
import type { WhisperClient } from "./whisper.js";
import {
  generateDraftFromSource,
  generateVideoScriptFromSource,
  type GenerationCareerProfile,
  type GenerationNote,
  type GenerationPersonalProfile,
  type GenerationProject,
} from "./generation.js";
import { parseBody, slugify } from "./validation.js";
import type { OpenPostClient } from "./openpost.js";
import type { VisualWorkerClient } from "./visual-worker.js";
import type { VideoWorkerClient } from "./video-worker.js";
import {
  assertAiDraftUsageAvailable,
  assertDeckExportUsageAvailable,
  assertVideoRenderUsageAvailable,
  assertVisualGenerationUsageAvailable,
} from "./usage.js";

type RouteDeps = {
  db: Db;
  identityProvider?: IdentityProvider;
  openPost?: OpenPostClient;
  comfyUi?: ComfyUiClient;
  visualWorker?: VisualWorkerClient;
  videoWorker?: VideoWorkerClient;
  deckWorker?: DeckWorkerClient;
  pokeeResearch?: PokeeResearchClient;
  miniClaw?: MiniClawClient;
  whisper?: WhisperClient;
  videoProviders?: VideoProviderRouter;
  storage?: StorageClient;
  mediaRuntimeProfile?: SocialOpsMediaRuntimeProfile;
  allowHeavyMediaWorkflows?: boolean;
  production: boolean;
};

const workspaceBody = z.object({
  name: z.string().min(1),
  type: z.enum(["personal", "career", "startup", "company", "agency", "creator", "team"]).default("personal"),
  plan: z.enum(["free", "student", "pro", "founder_freelancer", "studio"]).default("free"),
});

const personalProfileBody = z.object({
  name: z.string().default(""),
  headline: z.string().default(""),
  bio: z.string().default(""),
  location: z.string().default(""),
  education_json: z.array(z.unknown()).default([]),
  experience_json: z.array(z.unknown()).default([]),
  skills_json: z.array(z.string()).default([]),
  goals_json: z.array(z.string()).default([]),
  platforms_json: z.array(z.string()).default([]),
  tone_json: z.record(z.string(), z.unknown()).default({}),
});

const careerProfileBody = z.object({
  current_role: z.string().default(""),
  target_roles_json: z.array(z.string()).default([]),
  internship_status: z.string().default(""),
  industry: z.string().default(""),
  skills_to_show_json: z.array(z.string()).default([]),
  achievements_json: z.array(z.string()).default([]),
  portfolio_links_json: z.array(z.string()).default([]),
  content_pillars_json: z.array(z.string()).default([]),
});

const projectBody = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  type: z.enum(["startup", "portfolio", "school", "work", "freelance", "content", "open_source", "career", "other"]),
  description: z.string().default(""),
  stage: z.string().default(""),
  website: z.string().url().nullable().optional(),
  links_json: z.array(z.string()).default([]),
  goals_json: z.array(z.string()).default([]),
  content_pillars_json: z.array(z.string()).default([]),
  approved_claims_json: z.array(z.string()).default([]),
  forbidden_claims_json: z.array(z.string()).default([]),
});

const brandProfileBody = z.object({
  name: z.string().default(""),
  company_name: z.string().default(""),
  website: z.string().url().nullable().optional(),
  industry: z.string().default(""),
  description: z.string().default(""),
  target_customers_json: z.array(z.string()).default([]),
  brand_voice_json: z.record(z.string(), z.unknown()).default({}),
  offer_json: z.array(z.unknown()).default([]),
  proof_points_json: z.array(z.string()).default([]),
  forbidden_claims_json: z.array(z.string()).default([]),
  competitors_json: z.array(z.string()).default([]),
  platforms_json: z.array(z.enum(contentChannels)).default([]),
});

const agencyClientBody = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  company_name: z.string().default(""),
  industry: z.string().default(""),
  website: z.string().url().nullable().optional(),
  contact_name: z.string().default(""),
  contact_email: z.string().email().nullable().optional(),
  status: z.enum(["active", "paused", "archived"]).default("active"),
  brand_profile_json: z.record(z.string(), z.unknown()).default({}),
  content_pillars_json: z.array(z.string()).default([]),
  approval_rules_json: z.record(z.string(), z.unknown()).default({}),
});

const campaignBody = z.object({
  agency_client_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  objective: z.string().default(""),
  status: z.enum(["draft", "active", "paused", "completed", "archived"]).default("draft"),
  platforms_json: z.array(z.enum(contentChannels)).default([]),
  start_date: z.string().date().nullable().optional(),
  end_date: z.string().date().nullable().optional(),
  content_pillars_json: z.array(z.string()).default([]),
  deliverables_json: z.array(z.unknown()).default([]),
  kpis_json: z.record(z.string(), z.unknown()).default({}),
});

const mediaAssetBody = z.object({
  agency_client_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  source: z.enum(["upload", "comfyui", "remotion", "external", "manual"]),
  media_kind: z.enum(["image", "video", "audio", "voice", "text_visual", "document"]),
  title: z.string().default(""),
  url: z.string().url(),
  thumbnail_url: z.string().url().nullable().optional(),
  metadata_json: z.record(z.string(), z.unknown()).default({}),
  rights_json: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["draft", "approved", "used", "archived"]).default("draft"),
});

const ugcBriefBody = z.object({
  agency_client_id: z.string().uuid().nullable().optional(),
  project_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  product_or_offer: z.string().default(""),
  target_audience: z.string().default(""),
  platforms_json: z.array(z.enum(contentChannels)).default([]),
  hooks_json: z.array(z.string()).default([]),
  talking_points_json: z.array(z.string()).default([]),
  do_not_say_json: z.array(z.string()).default([]),
  deliverables_json: z.array(z.unknown()).default([]),
  status: z.enum(["draft", "needs_review", "approved", "in_production", "completed", "archived"]).default("draft"),
});

const captureNoteBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  type: z.enum(["daily_update", "weekly_update", "lesson", "achievement", "mistake", "idea", "link", "screenshot", "voice_note", "work_log"]),
  content: z.string().min(1),
  media_json: z.array(z.unknown()).default([]),
  tags_json: z.array(z.string()).default([]),
});

const contentDraftBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  agency_client_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  mode: z.enum(contentModes),
  channel: z.enum(contentChannels),
  type: z.enum(["post", "thread", "script", "carousel", "update", "reply", "outreach", "deck", "application_answer"]),
  title: z.string().default(""),
  hook: z.string().default(""),
  content: z.string().min(1),
  target_audience: z.string().default(""),
  purpose: z.string().default(""),
  generated_by_ai: z.boolean().default(true),
  reason_this_works: z.string().default(""),
  suggested_visual: z.string().default(""),
  source_note_ids_json: z.array(z.string()).default([]),
  media_asset_ids_json: z.array(z.string()).default([]),
  claims_used_json: z.array(z.string()).default([]),
  missing_info_json: z.array(z.string()).default([]),
  risk_notes: z.string().default(""),
});

const generateDraftBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  agency_client_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  source_note_ids: z.array(z.string().uuid()).optional(),
  template_key: z.string().optional(),
  mode: z.enum(contentModes),
  channel: z.enum(contentChannels),
  type: z.enum(["post", "thread", "script", "carousel", "update", "reply", "outreach", "deck", "application_answer"]).default("post"),
  target_audience: z.string().default(""),
  purpose: z.string().default(""),
});

const rankXBody = z.object({
  preferred_topics: z.array(z.string()).default([]),
  muted_topics: z.array(z.string()).default([]),
  recent_engaged_draft_ids: z.array(z.string().uuid()).default([]),
  preferred_channels: z.array(z.enum(contentChannels)).default(["x"]),
  limit: z.number().int().min(1).max(100).default(25),
});

const contentEnginePlanBody = z.object({
  platforms: z.array(z.enum(contentChannels)).default(["x", "linkedin", "tiktok", "reddit", "instagram", "youtube_shorts"]),
  account_count_by_platform: z.record(z.string(), z.number().int().min(0)).default({}),
  include_video: z.boolean().default(true),
  include_visuals: z.boolean().default(true),
  objective: z.string().default(""),
});

const localVideoPipelineBody = z.object({
  kind: z.enum(localVideoKinds),
  title: z.string().min(1),
  product_or_project: z.string().min(1),
  target_audience: z.string().default("builders and creators"),
  objective: z.string().default("Create useful social-native content and learn from performance."),
  platforms: z.array(z.enum(localVideoPlatforms)).default(["x", "linkedin", "tiktok", "reddit", "instagram", "youtube_shorts"]),
  source_facts: z.array(z.string()).default([]),
  uploaded_asset_ids: z.array(z.string()).default([]),
  real_screen_asset_ids: z.array(z.string()).default([]),
  include_ai_broll: z.boolean().default(true),
  include_voiceover: z.boolean().default(false),
});

const professionalVideoProviderPlanBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  content_draft_id: z.string().uuid().nullable().optional(),
  kind: z.enum(localVideoKinds),
  template_key: z.enum(professionalVideoTemplateKeys),
  product_or_project: z.string().min(1),
  objective: z.string().default("Create a professional social-native video."),
  target_audience: z.string().default("builders and creators"),
  script: z.string().optional(),
  product_url: z.string().url().optional(),
  reference_images: z.array(z.string()).default([]),
  screenshots: z.array(z.string()).default([]),
  screen_recordings: z.array(z.string()).default([]),
  aspect_ratio: z.enum(videoAspectRatios).default("9:16"),
  prefer_external: z.boolean().default(false),
  include_external_providers: z.boolean().default(false),
});

const approvalBody = z.object({
  action: z.enum(["approve", "reject"]),
  reviewer_note: z.string().optional(),
});

const manualPublishBody = z.object({
  published_at: z.string().datetime().optional(),
});

const attachMediaBody = z.object({
  media_asset_ids: z.array(z.string().uuid()).min(1),
});

const generateUgcDraftsBody = z.object({
  channels: z.array(z.enum(contentChannels)).default(["tiktok", "instagram", "youtube_shorts"]),
});

const openPostSyncBody = z.object({
  openpost_workspace_id: z.string().min(1),
  openpost_user_id: z.string().min(1),
  social_account_ids: z.array(z.string()).default([]),
  scheduled_at: z.string().datetime().nullable().optional(),
  random_delay_minutes: z.number().int().min(0).max(240).default(0),
});

const socialIdentityBody = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  role: z.string().default(""),
  audience: z.string().default(""),
  positioning: z.string().default(""),
  voice_json: z.record(z.string(), z.unknown()).default({}),
  content_pillars_json: z.array(z.string()).default([]),
  platform_focus_json: z.array(z.enum(contentChannels)).default([]),
  status: z.enum(["active", "paused", "archived"]).default("active"),
});

const socialAccountBody = z.object({
  identity_id: z.string().uuid().nullable().optional(),
  platform: z.enum(contentChannels),
  provider_account_id: z.string().min(1).optional(),
  handle: z.string().default(""),
  display_name: z.string().default(""),
  account_type: z.enum(["personal", "page", "brand", "community", "client"]).default("personal"),
  audience: z.string().default(""),
  content_pillars_json: z.array(z.string()).default([]),
  posting_rules_json: z.record(z.string(), z.unknown()).default({}),
  oauth_status: z.enum(["connected", "disconnected", "expired", "error"]).default("disconnected"),
  publishing_status: z.enum(["manual", "openpost", "postiz", "native_api", "disabled"]).default("manual"),
  capabilities_json: z.array(z.string()).default([]),
});

const generateContentSetBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  agency_client_id: z.string().uuid().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  source_note_ids: z.array(z.string().uuid()).optional(),
  platforms: z.array(z.enum(contentChannels)).default(["x", "linkedin", "tiktok", "reddit"]),
  mode: z.enum(contentModes).default("builder"),
  target_audience: z.string().default(""),
  purpose: z.string().default("Build online presence from real work."),
  preferred_topics: z.array(z.string()).default([]),
  muted_topics: z.array(z.string()).default([]),
  x_thread: z.boolean().default(false),
});

const contentMetricBody = z.object({
  platform: z.enum(contentChannels),
  impressions: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
  comments: z.number().int().min(0).optional(),
  shares: z.number().int().min(0).optional(),
  clicks: z.number().int().min(0).optional(),
  replies: z.number().int().min(0).optional(),
  profile_visits: z.number().int().min(0).optional(),
  leads: z.number().int().min(0).optional(),
});

const visualAssetBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  content_draft_id: z.string().uuid().nullable().optional(),
  type: z.string().min(1),
  prompt: z.string().min(1),
  workflow_key: z.string().default(""),
  workflow_json: z.record(z.string(), z.unknown()).nullable().optional(),
  queue_now: z.boolean().default(true),
});

const videoScriptBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  content_draft_id: z.string().uuid().nullable().optional(),
  platform: z.enum(["linkedin", "x", "tiktok", "instagram", "youtube_shorts", "website"]).default("tiktok"),
  mode: z.enum(["career", "student", "founder", "creator", "project", "product_demo"]).default("project"),
  video_type: z
    .enum(["career_lesson_vertical", "linkedin_professional_update", "founder_weekly_update", "product_demo", "project_build_log"])
    .default("career_lesson_vertical"),
  duration_seconds: z.number().int().min(15).max(90).default(30),
  source_note_ids: z.array(z.string().uuid()).default([]),
});

const videoJobBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  content_draft_id: z.string().uuid().nullable().optional(),
  video_script_id: z.string().uuid().nullable().optional(),
  template_key: z.string().min(1),
  render_provider: z.enum(videoRenderProviders).default("remotion"),
  aspect_ratio: z.enum(videoAspectRatios).default("9:16"),
});

const videoRenderBody = z.object({
  queue_now: z.boolean().default(true),
});

const videoApprovalBody = z.object({
  action: z.enum(["approve", "reject"]),
});

const videoAssetAttachBody = z.object({
  content_draft_id: z.string().uuid().optional(),
});

type VideoOpenPostBridgeRow = {
  asset_id: string;
  asset_status: string;
  bridge_id?: string | null;
  draft_id?: string | null;
  project_id?: string | null;
  mode?: string | null;
  channel?: string | null;
  type?: string | null;
  content?: string | null;
  draft_status?: string | null;
  target_audience?: string | null;
  purpose?: string | null;
  source_note_ids_json?: string[] | null;
  media_asset_ids_json?: string[] | null;
  claims_used_json?: string[] | null;
  missing_info_json?: string[] | null;
  risk_notes?: string | null;
};

type VideoExportPackageRow = {
  id: string;
  file_name: string;
  mime_type: string;
  storage_path: string;
  public_url?: string | null;
  duration_seconds?: number | null;
  width?: number | null;
  height?: number | null;
  status: string;
  video_job_id: string;
  draft_id?: string | null;
  draft_title?: string | null;
  draft_hook?: string | null;
  draft_content?: string | null;
  draft_channel?: string | null;
  draft_type?: string | null;
  draft_status?: string | null;
  draft_target_audience?: string | null;
  draft_purpose?: string | null;
  script_title?: string | null;
  script_hook?: string | null;
  script_platform?: string | null;
  script_status?: string | null;
  script_captions_json?: unknown[] | null;
};

const researchBriefBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  source_note_id: z.string().uuid().nullable().optional(),
  topic: z.string().min(1),
  question: z.string().default(""),
});

const deckBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  type: z.string().min(1),
  title: z.string().min(1),
  slides_json: z.array(z.unknown()).default([]),
  markdown: z.string().min(1),
  renderer: z.enum(["marp", "slidev"]).default("marp"),
  status: z.enum(["draft", "needs_review", "approved", "rendered", "failed", "archived"]).default("draft"),
});

const deckRenderBody = z.object({
  format: z.enum(["pdf", "html"]).default("pdf"),
  dry_run: z.boolean().default(false),
});

const applicationTypes = ["internship", "job", "accelerator", "funding", "grant", "school", "payment_provider", "other"] as const;

const applicationBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  type: z.enum(applicationTypes),
  deadline: z.string().datetime().nullable().optional(),
  url: z.string().url().nullable().optional(),
  status: z.string().default("draft"),
});

const applicationAnswerBody = z.object({
  question: z.string().min(1),
  answer: z.string().default(""),
  status: z.enum(["draft", "needs_review", "approved", "rejected", "archived"]).default("draft"),
  missing_info: z.array(z.string()).default([]),
});

const leadStatuses = ["new", "drafted", "contacted", "replied", "interested", "paid", "not_interested", "archived"] as const;

const leadBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1),
  email: z.string().email().nullable().optional(),
  linkedin_url: z.string().url().nullable().optional(),
  x_url: z.string().url().nullable().optional(),
  company: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  segment: z.string().default(""),
  source: z.string().default(""),
  status: z.enum(leadStatuses).default("new"),
  notes: z.string().default(""),
});

const leadUpdateBody = z.object({
  status: z.enum(leadStatuses).optional(),
  notes: z.string().optional(),
  segment: z.string().optional(),
  source: z.string().optional(),
  company: z.string().nullable().optional(),
  role: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  linkedin_url: z.string().url().nullable().optional(),
  x_url: z.string().url().nullable().optional(),
});

const outreachChannels = ["email", "linkedin", "x", "other"] as const;

const outreachMessageBody = z.object({
  lead_id: z.string().uuid().nullable().optional(),
  channel: z.enum(outreachChannels),
  subject: z.string().nullable().optional(),
  body: z.string().min(1),
  status: z.enum(["draft", "needs_review", "approved"]).default("draft"),
});

const outreachManualSentBody = z.object({
  sent_at: z.string().datetime().optional(),
});

const calendarQuery = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const viewportPresets = ["landscape_1920", "linkedin_1080", "vertical_1080", "square_1080"] as const;
const captureModes = ["screenshot", "screen_recording"] as const;
const sceneActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("wait_ms"), ms: z.number().int().min(0).max(60_000) }),
  z.object({ type: z.literal("wait_for"), selector: z.string().min(1), timeoutMs: z.number().int().min(100).max(60_000).optional() }),
  z.object({ type: z.literal("click"), selector: z.string().min(1) }),
  z.object({ type: z.literal("type"), selector: z.string().min(1), text: z.string(), delayMs: z.number().int().min(0).max(2000).optional() }),
  z.object({ type: z.literal("scroll"), y: z.number().int() }),
]);

const productDemoCreateBody = z.object({
  project_id: z.string().uuid().nullable().optional(),
  product_name: z.string().min(1),
  product_url: z.string().url(),
  goal: z.string().default(""),
  target_audience: z.string().default(""),
  platform: z.enum(["linkedin", "x", "tiktok", "instagram", "youtube_shorts"]).default("linkedin"),
});

const productDemoSceneBody = z.object({
  order: z.number().int().min(1),
  url: z.string().url(),
  action_description: z.string().default(""),
  narration: z.string().default(""),
  caption: z.string().default(""),
  duration_seconds: z.number().int().min(2).max(30).default(5),
  zoom_target_json: z.record(z.string(), z.unknown()).default({}),
});

const productDemoPlanBody = z.object({
  scenes: z.array(productDemoSceneBody).min(1).max(12).optional(),
});

const productDemoCaptureSceneBody = z.object({
  order: z.number().int().min(1),
  url: z.string().url(),
  viewport: z.enum(viewportPresets).default("vertical_1080"),
  mode: z.enum(captureModes).default("screenshot"),
  duration_ms: z.number().int().min(1000).max(30_000).optional(),
  settle_ms: z.number().int().min(0).max(15_000).optional(),
  actions: z.array(sceneActionSchema).default([]),
});

const productDemoCaptureBody = z.object({
  viewport: z.enum(viewportPresets).optional(),
  mode: z.enum(captureModes).optional(),
  scenes: z.array(productDemoCaptureSceneBody).optional(),
});

const productDemoRenderBody = z.object({
  aspect_ratio: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
});

const peopleUploadBody = z.object({
  url: z.string().url(),
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
  media_kind: z.enum(["video", "audio", "image"]).default("video"),
  size_bytes: z.number().int().min(0).optional(),
  duration_seconds: z.number().min(0).optional(),
  is_real_user: z.boolean().default(true),
  consent_attestation: z.string().optional(),
});

const uploadPresignBody = z.object({
  file_name: z.string().min(1).max(255),
  content_type: z.string().min(1).max(255),
  folder: z.string().regex(/^[a-zA-Z0-9_/.-]*$/u).max(128).optional(),
  size_bytes: z.number().int().min(0).max(2 * 1024 * 1024 * 1024).optional(),
  expires_seconds: z.number().int().min(60).max(60 * 60 * 6).optional(),
});

const peopleTranscribeBody = z.object({
  media_asset_id: z.string().uuid(),
  language: z.string().default("en"),
  model: z.enum(["tiny.en", "base.en", "small.en", "medium.en", "large-v3-turbo"]).default("small.en"),
});

const peopleEditBody = z.object({
  media_asset_id: z.string().uuid(),
  caption_track_id: z.string().uuid().optional(),
  target_duration_seconds: z.number().int().min(10).max(180).default(45),
  hook: z.string().default(""),
  cta: z.string().default(""),
});

const peopleRenderBody = z.object({
  media_asset_id: z.string().uuid(),
  caption_track_id: z.string().uuid().optional(),
  aspect_ratio: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
  hook: z.string().default(""),
  scenes: z
    .array(
      z.object({
        order: z.number().int().min(1),
        start_seconds: z.number().min(0),
        end_seconds: z.number().min(0),
        caption: z.string().default(""),
        narration: z.string().default(""),
      }),
    )
    .min(1),
});

const captionsGenerateBody = z.object({
  media_asset_id: z.string().uuid().optional(),
  audio_url: z.string().url().optional(),
  language: z.string().default("en"),
  model: z.enum(["tiny.en", "base.en", "small.en", "medium.en", "large-v3-turbo"]).default("small.en"),
});

const brollGenerateBody = z.object({
  source_image_url: z.string().url(),
  prompt: z.string().min(1),
  negative_prompt: z.string().optional(),
  motion_preset: z.string().min(1),
  provider: z.string().optional(),
  aspect_ratio: z.enum(["9:16", "16:9", "1:1", "4:5"]).default("9:16"),
  duration_seconds: z.number().int().min(2).max(15).optional(),
});

const brollPollBody = z.object({
  external_job_id: z.string().min(1),
  provider: z.string().min(1),
});

async function authenticate(request: FastifyRequest, deps: RouteDeps): Promise<AuthUser> {
  const user = deps.identityProvider
    ? await deps.identityProvider.resolve(request, deps.db)
    : await resolveDevAuthUser(deps.db, request, deps.production);
  request.authUser = user;
  return user;
}

export async function registerRoutes(app: FastifyInstance, deps: RouteDeps): Promise<void> {
  app.get("/health", async () => {
    await deps.db.one("SELECT 1 AS ok");
    return { ok: true };
  });

  app.get("/v1/meta", async () => ({
    product: "SocialOps",
    purpose: socialOpsPurpose,
    source_of_truth_tables: sourceOfTruthTables,
    content_modes: contentModes,
    content_channels: contentChannels,
    content_statuses: contentStatuses,
    target_platforms: targetPlatforms,
    comfy_media_kinds: comfyMediaKinds,
    comfy_workflow_presets: comfyWorkflowPresets,
    video_provider_statuses: listVideoProviderStatuses(process.env),
    professional_video_templates: professionalVideoTemplates,
    internal_algorithms: ["socialops-x-style-internal-v1"],
    media_runtime_profile: deps.mediaRuntimeProfile ?? "macbook_local",
    allow_heavy_media_workflows: deps.allowHeavyMediaWorkflows ?? false,
  }));

  app.get("/v1/content-engine/purpose", async () => createContentEnginePlan());

  app.get("/v1/content-engine/video-pipelines", async () => ({
    pipelines: createDefaultLocalVideoPlans(),
  }));

  app.get("/v1/content-engine/video-providers", async () => ({
    providers: listVideoProviderStatuses(process.env),
  }));

  app.get("/v1/content-engine/video-templates", async () => ({
    templates: professionalVideoTemplates,
  }));

  app.addHook("preHandler", async (request) => {
    if (
      request.url === "/health" ||
      request.url === "/v1/meta" ||
      request.url === "/v1/content-engine/purpose" ||
      request.url === "/v1/content-engine/video-pipelines" ||
      request.url === "/v1/content-engine/video-providers" ||
      request.url === "/v1/content-engine/video-templates"
    ) {
      return;
    }
    await authenticate(request, deps);
  });

  app.get("/v1/workspaces", async (request) => {
    return deps.db.query(
      `
        SELECT w.*
        FROM workspaces w
        JOIN workspace_members wm ON wm.workspace_id = w.id
        WHERE wm.user_id = $1
        ORDER BY w.created_at DESC
      `,
      [request.authUser.id],
    );
  });

  app.post("/v1/workspaces", async (request) => {
    const input = parseBody(workspaceBody, request.body);
    const entitlement = planEntitlements[input.plan as PlanKey];

    return deps.db.tx(async (client) => {
      const workspace = await client.query(
        `
          INSERT INTO workspaces (owner_user_id, name, type, plan)
          VALUES ($1, $2, $3, $4)
          RETURNING *
        `,
        [request.authUser.id, input.name, input.type, input.plan],
      );
      const workspaceRow = workspace.rows[0];

      await client.query(
        `
          INSERT INTO workspace_members (workspace_id, user_id, role)
          VALUES ($1, $2, 'owner')
        `,
        [workspaceRow.id, request.authUser.id],
      );

      await client.query(
        `
          INSERT INTO entitlements (
            workspace_id,
            plan,
            ai_drafts_per_month,
            visual_generations_per_month,
            video_renders_per_month,
            deck_exports_per_month,
            scheduled_posts_per_month,
            connected_accounts,
            granted_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `,
        [
          workspaceRow.id,
          input.plan,
          entitlement.aiDraftsPerMonth,
          entitlement.visualGenerationsPerMonth,
          entitlement.videoRendersPerMonth,
          entitlement.deckExportsPerMonth,
          entitlement.scheduledPostsPerMonth,
          entitlement.connectedAccounts,
          request.authUser.id,
        ],
      );

      await client.query(
        `
          INSERT INTO audit_logs (workspace_id, user_id, actor_type, action, target_type, target_id)
          VALUES ($1, $2, 'user', 'workspace.create', 'workspace', $1)
        `,
        [workspaceRow.id, request.authUser.id],
      );

      return workspaceRow;
    });
  });

  app.get("/v1/profile", async (request) => {
    const profile = await deps.db.one("SELECT * FROM personal_profiles WHERE user_id = $1", [request.authUser.id]);
    return profile ?? null;
  });

  app.put("/v1/profile", async (request) => {
    const input = parseBody(personalProfileBody, request.body);
    return deps.db.one(
      `
        INSERT INTO personal_profiles (
          user_id,
          name,
          headline,
          bio,
          location,
          education_json,
          experience_json,
          skills_json,
          goals_json,
          platforms_json,
          tone_json
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET
          name = EXCLUDED.name,
          headline = EXCLUDED.headline,
          bio = EXCLUDED.bio,
          location = EXCLUDED.location,
          education_json = EXCLUDED.education_json,
          experience_json = EXCLUDED.experience_json,
          skills_json = EXCLUDED.skills_json,
          goals_json = EXCLUDED.goals_json,
          platforms_json = EXCLUDED.platforms_json,
          tone_json = EXCLUDED.tone_json,
          updated_at = now()
        RETURNING *
      `,
      [
        request.authUser.id,
        input.name,
        input.headline,
        input.bio,
        input.location,
        JSON.stringify(input.education_json),
        JSON.stringify(input.experience_json),
        JSON.stringify(input.skills_json),
        JSON.stringify(input.goals_json),
        JSON.stringify(input.platforms_json),
        JSON.stringify(input.tone_json),
      ],
    );
  });

  app.get("/v1/career", async (request) => {
    const profile = await deps.db.one("SELECT * FROM career_profiles WHERE user_id = $1", [request.authUser.id]);
    return profile ?? null;
  });

  app.put("/v1/career", async (request) => {
    const input = parseBody(careerProfileBody, request.body);
    return deps.db.one(
      `
        INSERT INTO career_profiles (
          user_id,
          "current_role",
          target_roles_json,
          internship_status,
          industry,
          skills_to_show_json,
          achievements_json,
          portfolio_links_json,
          content_pillars_json
        )
        VALUES ($1, $2, $3::jsonb, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb)
        ON CONFLICT (user_id) DO UPDATE SET
          "current_role" = EXCLUDED."current_role",
          target_roles_json = EXCLUDED.target_roles_json,
          internship_status = EXCLUDED.internship_status,
          industry = EXCLUDED.industry,
          skills_to_show_json = EXCLUDED.skills_to_show_json,
          achievements_json = EXCLUDED.achievements_json,
          portfolio_links_json = EXCLUDED.portfolio_links_json,
          content_pillars_json = EXCLUDED.content_pillars_json,
          updated_at = now()
        RETURNING *
      `,
      [
        request.authUser.id,
        input.current_role,
        JSON.stringify(input.target_roles_json),
        input.internship_status,
        input.industry,
        JSON.stringify(input.skills_to_show_json),
        JSON.stringify(input.achievements_json),
        JSON.stringify(input.portfolio_links_json),
        JSON.stringify(input.content_pillars_json),
      ],
    );
  });

  app.get("/v1/workspaces/:workspaceId/brand", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return (await deps.db.one("SELECT * FROM brand_profiles WHERE workspace_id = $1", [workspaceId])) ?? null;
  });

  app.put("/v1/workspaces/:workspaceId/brand", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(brandProfileBody, request.body);

    return deps.db.one(
      `
        INSERT INTO brand_profiles (
          workspace_id,
          name,
          company_name,
          website,
          industry,
          description,
          target_customers_json,
          brand_voice_json,
          offer_json,
          proof_points_json,
          forbidden_claims_json,
          competitors_json,
          platforms_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb)
        ON CONFLICT (workspace_id) DO UPDATE SET
          name = EXCLUDED.name,
          company_name = EXCLUDED.company_name,
          website = EXCLUDED.website,
          industry = EXCLUDED.industry,
          description = EXCLUDED.description,
          target_customers_json = EXCLUDED.target_customers_json,
          brand_voice_json = EXCLUDED.brand_voice_json,
          offer_json = EXCLUDED.offer_json,
          proof_points_json = EXCLUDED.proof_points_json,
          forbidden_claims_json = EXCLUDED.forbidden_claims_json,
          competitors_json = EXCLUDED.competitors_json,
          platforms_json = EXCLUDED.platforms_json,
          updated_at = now()
        RETURNING *
      `,
      [
        workspaceId,
        input.name,
        input.company_name,
        input.website ?? null,
        input.industry,
        input.description,
        JSON.stringify(input.target_customers_json),
        JSON.stringify(input.brand_voice_json),
        JSON.stringify(input.offer_json),
        JSON.stringify(input.proof_points_json),
        JSON.stringify(input.forbidden_claims_json),
        JSON.stringify(input.competitors_json),
        JSON.stringify(input.platforms_json),
      ],
    );
  });

  app.get("/v1/workspaces/:workspaceId/clients", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM agency_clients WHERE workspace_id = $1 ORDER BY created_at DESC", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/clients", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(agencyClientBody, request.body);
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);
    if (!slug) {
      throw badRequest("client slug is required");
    }

    return deps.db.one(
      `
        INSERT INTO agency_clients (
          workspace_id,
          name,
          slug,
          company_name,
          industry,
          website,
          contact_name,
          contact_email,
          status,
          brand_profile_json,
          content_pillars_json,
          approval_rules_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb)
        RETURNING *
      `,
      [
        workspaceId,
        input.name,
        slug,
        input.company_name,
        input.industry,
        input.website ?? null,
        input.contact_name,
        input.contact_email ?? null,
        input.status,
        JSON.stringify(input.brand_profile_json),
        JSON.stringify(input.content_pillars_json),
        JSON.stringify(input.approval_rules_json),
      ],
    );
  });

  app.get("/v1/workspaces/:workspaceId/projects", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM projects WHERE workspace_id = $1 ORDER BY created_at DESC", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/projects", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(projectBody, request.body);
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);
    if (!slug) {
      throw badRequest("project slug is required");
    }

    const project = await deps.db.one(
      `
        INSERT INTO projects (
          workspace_id,
          name,
          slug,
          type,
          description,
          stage,
          website,
          links_json,
          goals_json,
          content_pillars_json,
          approved_claims_json,
          forbidden_claims_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb)
        RETURNING *
      `,
      [
        workspaceId,
        input.name,
        slug,
        input.type,
        input.description,
        input.stage,
        input.website ?? null,
        JSON.stringify(input.links_json),
        JSON.stringify(input.goals_json),
        JSON.stringify(input.content_pillars_json),
        JSON.stringify(input.approved_claims_json),
        JSON.stringify(input.forbidden_claims_json),
      ],
    );

    return project;
  });

  app.get("/v1/workspaces/:workspaceId/campaigns", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM campaigns WHERE workspace_id = $1 ORDER BY created_at DESC", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/campaigns", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(campaignBody, request.body);

    await assertWorkspaceReferenceExists(deps.db, workspaceId, "agency_clients", input.agency_client_id, "agency client not found");
    await assertWorkspaceReferenceExists(deps.db, workspaceId, "projects", input.project_id, "project not found");

    return deps.db.one(
      `
        INSERT INTO campaigns (
          workspace_id,
          agency_client_id,
          project_id,
          name,
          objective,
          status,
          platforms_json,
          start_date,
          end_date,
          content_pillars_json,
          deliverables_json,
          kpis_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::date, $9::date, $10::jsonb, $11::jsonb, $12::jsonb)
        RETURNING *
      `,
      [
        workspaceId,
        input.agency_client_id ?? null,
        input.project_id ?? null,
        input.name,
        input.objective,
        input.status,
        JSON.stringify(input.platforms_json),
        input.start_date ?? null,
        input.end_date ?? null,
        JSON.stringify(input.content_pillars_json),
        JSON.stringify(input.deliverables_json),
        JSON.stringify(input.kpis_json),
      ],
    );
  });

  app.get("/v1/workspaces/:workspaceId/operator/status", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);

    const [identities, accounts, draftStatusCounts, videoStatusCounts, recentDrafts] = await Promise.all([
      deps.db.query("SELECT * FROM social_identities WHERE workspace_id = $1 ORDER BY created_at DESC", [workspaceId]),
      deps.db.query("SELECT * FROM social_accounts WHERE workspace_id = $1 ORDER BY platform, display_name, handle", [workspaceId]),
      deps.db.query<{ status: string; count: string }>(
        "SELECT status, COUNT(*)::text AS count FROM content_drafts WHERE workspace_id = $1 GROUP BY status ORDER BY status",
        [workspaceId],
      ),
      deps.db.query<{ status: string; count: string }>(
        "SELECT status, COUNT(*)::text AS count FROM video_jobs WHERE workspace_id = $1 GROUP BY status ORDER BY status",
        [workspaceId],
      ),
      deps.db.query(
        `
          SELECT id, channel, type, title, hook, status, updated_at
          FROM content_drafts
          WHERE workspace_id = $1
          ORDER BY updated_at DESC
          LIMIT 10
        `,
        [workspaceId],
      ),
    ]);

    const accountCountsByPlatform = accounts.reduce<Record<string, number>>((acc, account) => {
      const platform = typeof account.platform === "string" ? account.platform : "unknown";
      acc[platform] = (acc[platform] ?? 0) + 1;
      return acc;
    }, {});

    return {
      workspace_id: workspaceId,
      identities,
      accounts,
      account_counts_by_platform: accountCountsByPlatform,
      draft_status_counts: draftStatusCounts,
      video_status_counts: videoStatusCounts,
      recent_drafts: recentDrafts,
      publishing_paths: {
        openpost: "available when SOCIALOPS_OPENPOST_INTERNAL_TOKEN and OpenPost workspace/user ids are configured",
        postiz: "separate AGPL service boundary; use as external service where useful",
        manual: "always available after human approval",
      },
      safeguards: {
        human_approval_required: true,
        browser_auto_posting: false,
        auto_dm: false,
        fake_engagement: false,
      },
    };
  });

  app.get("/v1/workspaces/:workspaceId/internet-identities", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM social_identities WHERE workspace_id = $1 ORDER BY created_at DESC", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/internet-identities", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(socialIdentityBody, request.body);
    const slug = input.slug ? slugify(input.slug) : slugify(input.name);
    if (!slug) {
      throw badRequest("identity slug is required");
    }

    return deps.db.one(
      `
        INSERT INTO social_identities (
          workspace_id,
          name,
          slug,
          role,
          audience,
          positioning,
          voice_json,
          content_pillars_json,
          platform_focus_json,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10)
        ON CONFLICT (workspace_id, slug) DO UPDATE SET
          name = EXCLUDED.name,
          role = EXCLUDED.role,
          audience = EXCLUDED.audience,
          positioning = EXCLUDED.positioning,
          voice_json = EXCLUDED.voice_json,
          content_pillars_json = EXCLUDED.content_pillars_json,
          platform_focus_json = EXCLUDED.platform_focus_json,
          status = EXCLUDED.status,
          updated_at = now()
        RETURNING *
      `,
      [
        workspaceId,
        input.name,
        slug,
        input.role,
        input.audience,
        input.positioning,
        JSON.stringify(input.voice_json),
        JSON.stringify(input.content_pillars_json),
        JSON.stringify(input.platform_focus_json),
        input.status,
      ],
    );
  });

  app.get("/v1/workspaces/:workspaceId/social-accounts", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query(
      `
        SELECT
          social_accounts.*,
          social_identities.name AS identity_name,
          social_identities.slug AS identity_slug
        FROM social_accounts
        LEFT JOIN social_identities ON social_identities.id = social_accounts.identity_id
        WHERE social_accounts.workspace_id = $1
        ORDER BY social_accounts.platform, social_accounts.display_name, social_accounts.handle
      `,
      [workspaceId],
    );
  });

  app.post("/v1/workspaces/:workspaceId/social-accounts", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(socialAccountBody, request.body);

    if (input.identity_id) {
      const identity = await deps.db.one("SELECT id FROM social_identities WHERE id = $1 AND workspace_id = $2", [
        input.identity_id,
        workspaceId,
      ]);
      if (!identity) {
        throw notFound("internet identity not found");
      }
    }

    const providerAccountId = (input.provider_account_id ?? input.handle) || input.display_name;
    if (!providerAccountId) {
      throw badRequest("provider_account_id, handle, or display_name is required");
    }

    return deps.db.one(
      `
        INSERT INTO social_accounts (
          workspace_id,
          identity_id,
          platform,
          provider_account_id,
          handle,
          display_name,
          account_type,
          audience,
          content_pillars_json,
          posting_rules_json,
          oauth_status,
          publishing_status,
          capabilities_json,
          connected_at,
          disconnected_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13::jsonb, $14, $15)
        ON CONFLICT (workspace_id, platform, provider_account_id) DO UPDATE SET
          identity_id = EXCLUDED.identity_id,
          handle = EXCLUDED.handle,
          display_name = EXCLUDED.display_name,
          account_type = EXCLUDED.account_type,
          audience = EXCLUDED.audience,
          content_pillars_json = EXCLUDED.content_pillars_json,
          posting_rules_json = EXCLUDED.posting_rules_json,
          oauth_status = EXCLUDED.oauth_status,
          publishing_status = EXCLUDED.publishing_status,
          capabilities_json = EXCLUDED.capabilities_json,
          connected_at = EXCLUDED.connected_at,
          disconnected_at = EXCLUDED.disconnected_at,
          updated_at = now()
        RETURNING *
      `,
      [
        workspaceId,
        input.identity_id ?? null,
        input.platform,
        providerAccountId,
        input.handle,
        input.display_name || input.handle || providerAccountId,
        input.account_type,
        input.audience,
        JSON.stringify(input.content_pillars_json),
        JSON.stringify(input.posting_rules_json),
        input.oauth_status,
        input.publishing_status,
        JSON.stringify(input.capabilities_json),
        input.oauth_status === "connected" ? new Date().toISOString() : null,
        input.oauth_status === "connected" ? null : new Date().toISOString(),
      ],
    );
  });

  app.get("/v1/workspaces/:workspaceId/media-assets", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM media_assets WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/media-assets", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(mediaAssetBody, request.body);

    await assertWorkspaceReferenceExists(deps.db, workspaceId, "agency_clients", input.agency_client_id, "agency client not found");
    await assertWorkspaceReferenceExists(deps.db, workspaceId, "projects", input.project_id, "project not found");
    await assertWorkspaceReferenceExists(deps.db, workspaceId, "campaigns", input.campaign_id, "campaign not found");

    return deps.db.one(
      `
        INSERT INTO media_assets (
          workspace_id,
          user_id,
          agency_client_id,
          project_id,
          campaign_id,
          source,
          media_kind,
          title,
          url,
          thumbnail_url,
          metadata_json,
          rights_json,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12::jsonb, $13)
        RETURNING *
      `,
      [
        workspaceId,
        request.authUser.id,
        input.agency_client_id ?? null,
        input.project_id ?? null,
        input.campaign_id ?? null,
        input.source,
        input.media_kind,
        input.title,
        input.url,
        input.thumbnail_url ?? null,
        JSON.stringify(input.metadata_json),
        JSON.stringify(input.rights_json),
        input.status,
      ],
    );
  });

  app.get("/v1/workspaces/:workspaceId/ugc-briefs", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM ugc_briefs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/ugc-briefs", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(ugcBriefBody, request.body);

    await assertWorkspaceReferenceExists(deps.db, workspaceId, "agency_clients", input.agency_client_id, "agency client not found");
    await assertWorkspaceReferenceExists(deps.db, workspaceId, "projects", input.project_id, "project not found");
    await assertWorkspaceReferenceExists(deps.db, workspaceId, "campaigns", input.campaign_id, "campaign not found");

    return deps.db.one(
      `
        INSERT INTO ugc_briefs (
          workspace_id,
          agency_client_id,
          project_id,
          campaign_id,
          title,
          product_or_offer,
          target_audience,
          platforms_json,
          hooks_json,
          talking_points_json,
          do_not_say_json,
          deliverables_json,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13)
        RETURNING *
      `,
      [
        workspaceId,
        input.agency_client_id ?? null,
        input.project_id ?? null,
        input.campaign_id ?? null,
        input.title,
        input.product_or_offer,
        input.target_audience,
        JSON.stringify(input.platforms_json),
        JSON.stringify(input.hooks_json),
        JSON.stringify(input.talking_points_json),
        JSON.stringify(input.do_not_say_json),
        JSON.stringify(input.deliverables_json),
        input.status,
      ],
    );
  });

  app.get("/v1/workspaces/:workspaceId/capture-notes", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM capture_notes WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/capture-notes", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(captureNoteBody, request.body);

    return deps.db.one(
      `
        INSERT INTO capture_notes (workspace_id, project_id, user_id, type, content, media_json, tags_json)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
        RETURNING *
      `,
      [
        workspaceId,
        input.project_id ?? null,
        request.authUser.id,
        input.type,
        input.content,
        JSON.stringify(input.media_json),
        JSON.stringify(input.tags_json),
      ],
    );
  });

  app.get("/v1/workspaces/:workspaceId/content-drafts", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM content_drafts WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/content-drafts", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(contentDraftBody, request.body);
    const status = input.generated_by_ai ? "needs_review" : "draft";

    await assertWorkspaceReferenceExists(deps.db, workspaceId, "projects", input.project_id, "project not found");
    await assertWorkspaceReferenceExists(deps.db, workspaceId, "agency_clients", input.agency_client_id, "agency client not found");
    await assertWorkspaceReferenceExists(deps.db, workspaceId, "campaigns", input.campaign_id, "campaign not found");
    await assertMediaAssetsExist(deps.db, workspaceId, input.media_asset_ids_json);

    return deps.db.one(
      `
        INSERT INTO content_drafts (
          workspace_id,
          project_id,
          agency_client_id,
          campaign_id,
          user_id,
          mode,
          channel,
          type,
          title,
          hook,
          content,
          status,
          target_audience,
          purpose,
          generated_by_ai,
          reason_this_works,
          suggested_visual,
          source_note_ids_json,
          media_asset_ids_json,
          claims_used_json,
          missing_info_json,
          risk_notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18::jsonb, $19::jsonb, $20::jsonb, $21::jsonb, $22)
        RETURNING *
      `,
      [
        workspaceId,
        input.project_id ?? null,
        input.agency_client_id ?? null,
        input.campaign_id ?? null,
        request.authUser.id,
        input.mode,
        input.channel,
        input.type,
        input.title,
        input.hook,
        input.content,
        status,
        input.target_audience,
        input.purpose,
        input.generated_by_ai,
        input.reason_this_works,
        input.suggested_visual,
        JSON.stringify(input.source_note_ids_json),
        JSON.stringify(input.media_asset_ids_json),
        JSON.stringify(input.claims_used_json),
        JSON.stringify(input.missing_info_json),
        input.risk_notes,
      ],
    );
  });

  app.post("/v1/workspaces/:workspaceId/content-drafts/rank-x", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    const input = parseBody(rankXBody, request.body);

    const drafts = await deps.db.query<{
      id: string;
      channel: string;
      title: string;
      hook: string;
      content: string;
      status: string;
      created_at: string;
      updated_at: string;
      media_asset_ids_json: string[] | null;
      claims_used_json: string[] | null;
      missing_info_json: string[] | null;
      metrics_json: Record<string, unknown> | null;
    }>(
      `
        SELECT
          id,
          channel,
          title,
          hook,
          content,
          status,
          created_at,
          updated_at,
          media_asset_ids_json,
          claims_used_json,
          missing_info_json,
          metrics_json
        FROM content_drafts
        WHERE workspace_id = $1
          AND channel = ANY($2::text[])
          AND status NOT IN ('rejected', 'failed', 'archived')
        ORDER BY updated_at DESC
        LIMIT 500
      `,
      [workspaceId, input.preferred_channels.length > 0 ? input.preferred_channels : ["x"]],
    );

    const ranked = rankXStyleCandidates(drafts, {
      preferredTopics: input.preferred_topics,
      mutedTopics: input.muted_topics,
      recentEngagedDraftIds: input.recent_engaged_draft_ids,
      preferredChannels: input.preferred_channels,
    }).slice(0, input.limit);

    return {
      algorithm: "socialops-x-style-internal-v1",
      ranked,
    };
  });

  app.post("/v1/workspaces/:workspaceId/content-engine/plan", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    const input = parseBody(contentEnginePlanBody, request.body);
    const supportedPlatformKeys = new Set<string>(targetPlatforms.map((platform) => platform.key));
    const platforms = input.platforms.filter((platform): platform is TargetPlatformKey => supportedPlatformKeys.has(platform));

    return createContentEnginePlan({
      platforms,
      accountCountByPlatform: input.account_count_by_platform as Partial<Record<TargetPlatformKey, number>>,
      includeVideo: input.include_video,
      includeVisuals: input.include_visuals,
      objective: input.objective,
    });
  });

  app.post("/v1/workspaces/:workspaceId/content-engine/video-pipeline", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    const input = parseBody(localVideoPipelineBody, request.body);

    return createLocalVideoPipelinePlan({
      kind: input.kind,
      title: input.title,
      productOrProject: input.product_or_project,
      targetAudience: input.target_audience,
      objective: input.objective,
      platforms: input.platforms,
      sourceFacts: input.source_facts,
      uploadedAssetIds: input.uploaded_asset_ids,
      realScreenAssetIds: input.real_screen_asset_ids,
      includeAiBroll: input.include_ai_broll,
      includeVoiceover: input.include_voiceover,
    });
  });

  app.post("/v1/workspaces/:workspaceId/content-engine/professional-video-plan", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    const input = parseBody(professionalVideoProviderPlanBody, request.body);

    return createProfessionalVideoProviderPlan(
      {
        kind: input.kind,
        templateKey: input.template_key,
        productOrProject: input.product_or_project,
        objective: input.objective,
        targetAudience: input.target_audience,
        script: input.script,
        productUrl: input.product_url,
        referenceImages: input.reference_images,
        screenshots: input.screenshots,
        screenRecordings: input.screen_recordings,
        aspectRatio: input.aspect_ratio,
        preferExternal: input.prefer_external,
        includeExternalProviders: input.include_external_providers,
      },
      process.env,
    );
  });

  app.post("/v1/workspaces/:workspaceId/content-engine/professional-video-plan/comfy-assets", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(professionalVideoProviderPlanBody, request.body);

    await assertWorkspaceReferenceExists(deps.db, workspaceId, "projects", input.project_id, "project not found");
    if (input.content_draft_id) {
      const draft = await deps.db.one("SELECT id FROM content_drafts WHERE id = $1 AND workspace_id = $2", [
        input.content_draft_id,
        workspaceId,
      ]);
      if (!draft) {
        throw notFound("content draft not found");
      }
    }

    const plan = createProfessionalVideoProviderPlan(
      {
        kind: input.kind,
        templateKey: input.template_key,
        productOrProject: input.product_or_project,
        objective: input.objective,
        targetAudience: input.target_audience,
        script: input.script,
        productUrl: input.product_url,
        referenceImages: input.reference_images,
        screenshots: input.screenshots,
        screenRecordings: input.screen_recordings,
        aspectRatio: input.aspect_ratio,
        preferExternal: input.prefer_external,
        includeExternalProviders: input.include_external_providers,
      },
      process.env,
    );

    return deps.db.tx(async (client) => {
      const assets = [];
      for (const job of plan.comfyClipJobs) {
        const asset = await client.query(
          `
            INSERT INTO visual_assets (
              workspace_id,
              user_id,
              project_id,
              content_draft_id,
              type,
              media_kind,
              prompt,
              workflow_key,
              workflow_json,
              external_provider,
              external_job_id,
              status,
              error
            )
            VALUES ($1, $2, $3, $4, $5, 'video', $6, $7, $8::jsonb, NULL, NULL, 'draft', NULL)
            RETURNING *
          `,
          [
            workspaceId,
            request.authUser.id,
            input.project_id ?? null,
            input.content_draft_id ?? null,
            job.type,
            job.prompt,
            job.workflowKey,
            JSON.stringify({
              provider_plan: {
                template_key: input.template_key,
                product_or_project: input.product_or_project,
                scene_order: job.sceneOrder,
                negative_prompt: job.negativePrompt,
                width: job.width,
                height: job.height,
                queue_now: job.queueNow,
                reason: job.reason,
              },
            }),
          ],
        );
        assets.push(asset.rows[0]);
      }

      return {
        plan,
        visual_assets: assets,
      };
    });
  });

  app.post("/v1/workspaces/:workspaceId/generate-draft", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(generateDraftBody, request.body);

    await assertAiDraftUsageAvailable(deps.db, workspaceId, 1);
    await assertWorkspaceReferenceExists(deps.db, workspaceId, "agency_clients", input.agency_client_id, "agency client not found");
    await assertWorkspaceReferenceExists(deps.db, workspaceId, "campaigns", input.campaign_id, "campaign not found");

    const [personalProfile, careerProfile] = await Promise.all([
      deps.db.one<GenerationPersonalProfile>("SELECT * FROM personal_profiles WHERE user_id = $1", [request.authUser.id]),
      deps.db.one<GenerationCareerProfile>("SELECT * FROM career_profiles WHERE user_id = $1", [request.authUser.id]),
    ]);

    const project = input.project_id
      ? await deps.db.one<GenerationProject>(
          `
            SELECT *
            FROM projects
            WHERE id = $1 AND workspace_id = $2
          `,
          [input.project_id, workspaceId],
        )
      : null;
    if (input.project_id && !project) {
      throw notFound("project not found");
    }

    const notes =
      input.source_note_ids && input.source_note_ids.length > 0
        ? await deps.db.query<GenerationNote>(
            `
              SELECT id, type, content, created_at
              FROM capture_notes
              WHERE workspace_id = $1
                AND id = ANY($2::uuid[])
              ORDER BY created_at DESC
            `,
            [workspaceId, input.source_note_ids],
          )
        : await deps.db.query<GenerationNote>(
            `
              SELECT id, type, content, created_at
              FROM capture_notes
              WHERE workspace_id = $1
                AND ($2::uuid IS NULL OR project_id = $2::uuid)
              ORDER BY created_at DESC
              LIMIT 5
            `,
            [workspaceId, input.project_id ?? null],
          );

    const generated = generateDraftFromSource({
      templateKey: input.template_key,
      mode: input.mode,
      channel: input.channel,
      type: input.type,
      targetAudience: input.target_audience,
      purpose: input.purpose,
      personalProfile,
      careerProfile,
      project,
      notes,
    });

    return deps.db.tx(async (client) => {
      const draft = await client.query(
        `
          INSERT INTO content_drafts (
            workspace_id,
            project_id,
            agency_client_id,
            campaign_id,
            user_id,
            mode,
            channel,
            type,
            title,
            hook,
            content,
            status,
            target_audience,
            purpose,
            generated_by_ai,
            reason_this_works,
            suggested_visual,
            source_note_ids_json,
            media_asset_ids_json,
            claims_used_json,
            missing_info_json,
            risk_notes
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'needs_review', $12, $13, true, $14, $15, $16::jsonb, '[]'::jsonb, $17::jsonb, $18::jsonb, $19)
          RETURNING *
        `,
        [
          workspaceId,
          input.project_id ?? null,
          input.agency_client_id ?? null,
          input.campaign_id ?? null,
          request.authUser.id,
          generated.mode,
          generated.channel,
          generated.type,
          generated.title,
          generated.hook,
          generated.content,
          generated.target_audience,
          generated.purpose,
          generated.reason_this_works,
          generated.suggested_visual,
          JSON.stringify(generated.source_note_ids_json),
          JSON.stringify(generated.claims_used_json),
          JSON.stringify(generated.missing_info_json),
          generated.risk_notes,
        ],
      );

      await client.query(
        `
          INSERT INTO usage_events (workspace_id, user_id, event_type, quantity, metadata_json)
          VALUES ($1, $2, 'ai_draft', 1, $3::jsonb)
        `,
        [
          workspaceId,
          request.authUser.id,
          JSON.stringify({
            mode: generated.mode,
            channel: generated.channel,
            type: generated.type,
            source: "socialops-template-provider",
          }),
        ],
      );

      return draft.rows[0];
    });
  });

  app.post("/v1/workspaces/:workspaceId/generate-content-set", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(generateContentSetBody, request.body);
    const platforms = Array.from(new Set(input.platforms));
    if (platforms.length === 0) {
      throw badRequest("at least one platform is required");
    }

    await assertAiDraftUsageAvailable(deps.db, workspaceId, platforms.length);
    await assertWorkspaceReferenceExists(deps.db, workspaceId, "agency_clients", input.agency_client_id, "agency client not found");
    await assertWorkspaceReferenceExists(deps.db, workspaceId, "campaigns", input.campaign_id, "campaign not found");

    const [personalProfile, careerProfile] = await Promise.all([
      deps.db.one<GenerationPersonalProfile>("SELECT * FROM personal_profiles WHERE user_id = $1", [request.authUser.id]),
      deps.db.one<GenerationCareerProfile>("SELECT * FROM career_profiles WHERE user_id = $1", [request.authUser.id]),
    ]);

    const project = input.project_id
      ? await deps.db.one<GenerationProject>(
          `
            SELECT *
            FROM projects
            WHERE id = $1 AND workspace_id = $2
          `,
          [input.project_id, workspaceId],
        )
      : null;
    if (input.project_id && !project) {
      throw notFound("project not found");
    }

    const notes =
      input.source_note_ids && input.source_note_ids.length > 0
        ? await deps.db.query<GenerationNote>(
            `
              SELECT id, type, content, created_at
              FROM capture_notes
              WHERE workspace_id = $1
                AND id = ANY($2::uuid[])
              ORDER BY created_at DESC
            `,
            [workspaceId, input.source_note_ids],
          )
        : await deps.db.query<GenerationNote>(
            `
              SELECT id, type, content, created_at
              FROM capture_notes
              WHERE workspace_id = $1
                AND ($2::uuid IS NULL OR project_id = $2::uuid)
              ORDER BY created_at DESC
              LIMIT 5
            `,
            [workspaceId, input.project_id ?? null],
          );

    const generatedByPlatform = platforms.map((channel) =>
      generateDraftFromSource({
        mode: input.mode,
        channel,
        type: defaultDraftTypeForChannel(channel, input.x_thread),
        targetAudience: input.target_audience,
        purpose: input.purpose,
        personalProfile,
        careerProfile,
        project,
        notes,
      }),
    );

    return deps.db.tx(async (client) => {
      const created: Array<{
        id: string;
        channel: string;
        content: string;
        title?: string;
        hook?: string;
        status?: string;
        created_at?: string;
        updated_at?: string;
        media_asset_ids_json?: string[] | null;
        claims_used_json?: string[] | null;
        missing_info_json?: string[] | null;
        metrics_json?: Record<string, unknown> | null;
      }> = [];
      for (const generated of generatedByPlatform) {
        const draft = await client.query<{
          id: string;
          channel: string;
          content: string;
          title?: string;
          hook?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
          media_asset_ids_json?: string[] | null;
          claims_used_json?: string[] | null;
          missing_info_json?: string[] | null;
          metrics_json?: Record<string, unknown> | null;
        }>(
          `
            INSERT INTO content_drafts (
              workspace_id,
              project_id,
              agency_client_id,
              campaign_id,
              user_id,
              mode,
              channel,
              type,
              title,
              hook,
              content,
              status,
              target_audience,
              purpose,
              generated_by_ai,
              reason_this_works,
              suggested_visual,
              source_note_ids_json,
              media_asset_ids_json,
              claims_used_json,
              missing_info_json,
              risk_notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'needs_review', $12, $13, true, $14, $15, $16::jsonb, '[]'::jsonb, $17::jsonb, $18::jsonb, $19)
            RETURNING *
          `,
          [
            workspaceId,
            input.project_id ?? null,
            input.agency_client_id ?? null,
            input.campaign_id ?? null,
            request.authUser.id,
            generated.mode,
            generated.channel,
            generated.type,
            generated.title,
            generated.hook,
            generated.content,
            generated.target_audience,
            generated.purpose,
            generated.reason_this_works,
            generated.suggested_visual,
            JSON.stringify(generated.source_note_ids_json),
            JSON.stringify(generated.claims_used_json),
            JSON.stringify(generated.missing_info_json),
            generated.risk_notes,
          ],
        );
        created.push(draft.rows[0]);
      }

      await client.query(
        `
          INSERT INTO usage_events (workspace_id, user_id, event_type, quantity, metadata_json)
          VALUES ($1, $2, 'ai_draft', $3, $4::jsonb)
        `,
        [
          workspaceId,
          request.authUser.id,
          created.length,
          JSON.stringify({
            source: "content_set",
            platforms,
            mode: input.mode,
            project_id: input.project_id ?? null,
          }),
        ],
      );

      const rankedX = rankXStyleCandidates(
        created.filter((draft) => draft.channel === "x"),
        {
          preferredTopics: input.preferred_topics,
          mutedTopics: input.muted_topics,
          preferredChannels: ["x"],
        },
      );

      return {
        drafts: created,
        x_algorithm: {
          algorithm: "socialops-x-style-internal-v1",
          ranked: rankedX,
        },
        next_steps: [
          "Review and approve the drafts you actually want to publish.",
          "Use the publish package endpoint for manual publishing or OpenPost handoff.",
          "Enter real metrics after publishing so future ranking improves.",
        ],
      };
    });
  });

  app.post("/v1/workspaces/:workspaceId/content-drafts/:draftId/approval", async (request) => {
    const { workspaceId, draftId } = request.params as { workspaceId: string; draftId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(approvalBody, request.body);
    const draft = await deps.db.one<{ id: string; status: string }>(
      "SELECT id, status FROM content_drafts WHERE id = $1 AND workspace_id = $2",
      [draftId, workspaceId],
    );
    if (!draft) {
      throw notFound("content draft not found");
    }

    const nextStatus = input.action === "approve" ? "approved" : "rejected";
    if (!canTransitionContent(draft.status as never, nextStatus as never)) {
      throw badRequest(`cannot transition content draft from ${draft.status} to ${nextStatus}`);
    }

    return deps.db.tx(async (client) => {
      const updated = await client.query(
        `
          UPDATE content_drafts
          SET status = $1, updated_at = now()
          WHERE id = $2 AND workspace_id = $3
          RETURNING *
        `,
        [nextStatus, draftId, workspaceId],
      );

      await client.query(
        `
          INSERT INTO approval_items (workspace_id, item_type, item_id, requested_action, status, reviewer_user_id, reviewer_note)
          VALUES ($1, 'content_draft', $2, 'approve', $3, $4, $5)
        `,
        [workspaceId, draftId, nextStatus === "approved" ? "approved" : "rejected", request.authUser.id, input.reviewer_note ?? null],
      );

      return updated.rows[0];
    });
  });

  app.post("/v1/workspaces/:workspaceId/content-drafts/:draftId/manual-publish", async (request) => {
    const { workspaceId, draftId } = request.params as { workspaceId: string; draftId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(manualPublishBody, request.body);
    const draft = await deps.db.one<{ id: string; status: string }>(
      "SELECT id, status FROM content_drafts WHERE id = $1 AND workspace_id = $2",
      [draftId, workspaceId],
    );
    if (!draft) {
      throw notFound("content draft not found");
    }
    if (!canMarkManuallyPublished(draft.status as never)) {
      throw badRequest("only approved or scheduled drafts can be manually published");
    }

    return deps.db.one(
      `
        UPDATE content_drafts
        SET status = 'manually_published',
          published_at = COALESCE($1::timestamptz, now()),
          updated_at = now()
        WHERE id = $2 AND workspace_id = $3
        RETURNING *
      `,
      [input.published_at ?? null, draftId, workspaceId],
    );
  });

  app.get("/v1/workspaces/:workspaceId/content-drafts/:draftId/publish-package", async (request) => {
    const { workspaceId, draftId } = request.params as { workspaceId: string; draftId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    const draft = await deps.db.one<{
      id: string;
      channel: string;
      type: string;
      title: string;
      hook: string;
      content: string;
      status: string;
      target_audience: string;
      purpose: string;
      media_asset_ids_json: string[];
      missing_info_json: string[];
      risk_notes: string;
    }>(
      `
        SELECT id, channel, type, title, hook, content, status, target_audience, purpose, media_asset_ids_json, missing_info_json, risk_notes
        FROM content_drafts
        WHERE id = $1 AND workspace_id = $2
      `,
      [draftId, workspaceId],
    );
    if (!draft) {
      throw notFound("content draft not found");
    }

    const accounts = await deps.db.query(
      `
        SELECT id, platform, handle, display_name, oauth_status, publishing_status, capabilities_json
        FROM social_accounts
        WHERE workspace_id = $1 AND platform = $2
        ORDER BY publishing_status, display_name, handle
      `,
      [workspaceId, draft.channel],
    );
    const blockedBy = [
      ...(["approved", "scheduled", "manually_published", "published"].includes(draft.status)
        ? []
        : ["Approve the draft before publishing or scheduling."]),
      ...(Array.isArray(draft.missing_info_json) && draft.missing_info_json.length > 0
        ? [`Resolve or accept missing info: ${draft.missing_info_json.join(", ")}`]
        : []),
    ];
    const openPostAccounts = accounts.filter((account) => account.publishing_status === "openpost" && account.oauth_status === "connected");

    return {
      draft,
      accounts,
      manual_publish: {
        ready: blockedBy.length === 0,
        blocked_by: blockedBy,
        copy: draft.content,
        instructions: manualTextPublishInstructions(draft.channel),
      },
      openpost_handoff: {
        ready: blockedBy.length === 0 && openPostAccounts.length > 0,
        socialops_account_ids: openPostAccounts.map((account) => account.id),
        openpost_account_ids: openPostAccounts.map((account) => account.provider_account_id),
        blocked_by: [
          ...blockedBy,
          ...(openPostAccounts.length > 0 ? [] : [`No connected OpenPost account is registered for ${draft.channel}.`]),
        ],
      },
      compliance: {
        human_approval_required: true,
        no_browser_automation: true,
        no_auto_dm: true,
        no_fake_engagement: true,
      },
    };
  });

  app.get("/v1/workspaces/:workspaceId/content-drafts/:draftId/metrics", async (request) => {
    const { workspaceId, draftId } = request.params as { workspaceId: string; draftId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query(
      `
        SELECT *
        FROM content_metrics
        WHERE workspace_id = $1 AND content_draft_id = $2
        ORDER BY created_at DESC
      `,
      [workspaceId, draftId],
    );
  });

  app.post("/v1/workspaces/:workspaceId/content-drafts/:draftId/metrics", async (request) => {
    const { workspaceId, draftId } = request.params as { workspaceId: string; draftId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(contentMetricBody, request.body);
    const draft = await deps.db.one("SELECT id FROM content_drafts WHERE id = $1 AND workspace_id = $2", [draftId, workspaceId]);
    if (!draft) {
      throw notFound("content draft not found");
    }

    return deps.db.tx(async (client) => {
      const metric = await client.query(
        `
          INSERT INTO content_metrics (
            workspace_id,
            content_draft_id,
            platform,
            impressions,
            likes,
            comments,
            shares,
            clicks,
            replies,
            profile_visits,
            leads,
            entered_manually
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true)
          RETURNING *
        `,
        [
          workspaceId,
          draftId,
          input.platform,
          input.impressions ?? null,
          input.likes ?? null,
          input.comments ?? null,
          input.shares ?? null,
          input.clicks ?? null,
          input.replies ?? null,
          input.profile_visits ?? null,
          input.leads ?? null,
        ],
      );

      const totals = await client.query(
        `
          SELECT
            COALESCE(SUM(impressions), 0)::int AS impressions,
            COALESCE(SUM(likes), 0)::int AS likes,
            COALESCE(SUM(comments), 0)::int AS comments,
            COALESCE(SUM(shares), 0)::int AS shares,
            COALESCE(SUM(clicks), 0)::int AS clicks,
            COALESCE(SUM(replies), 0)::int AS replies,
            COALESCE(SUM(profile_visits), 0)::int AS profile_visits,
            COALESCE(SUM(leads), 0)::int AS leads
          FROM content_metrics
          WHERE workspace_id = $1 AND content_draft_id = $2
        `,
        [workspaceId, draftId],
      );

      const updatedDraft = await client.query(
        `
          UPDATE content_drafts
          SET metrics_json = $1::jsonb,
            updated_at = now()
          WHERE id = $2 AND workspace_id = $3
          RETURNING *
        `,
        [
          JSON.stringify({
            ...totals.rows[0],
            last_metric_id: metric.rows[0]?.id,
            last_metric_at: metric.rows[0]?.created_at,
          }),
          draftId,
          workspaceId,
        ],
      );

      return {
        metric: metric.rows[0],
        draft: updatedDraft.rows[0],
      };
    });
  });

  app.post("/v1/workspaces/:workspaceId/content-drafts/:draftId/media-assets", async (request) => {
    const { workspaceId, draftId } = request.params as { workspaceId: string; draftId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(attachMediaBody, request.body);

    const draft = await deps.db.one<{ id: string; media_asset_ids_json: string[] }>(
      "SELECT id, media_asset_ids_json FROM content_drafts WHERE id = $1 AND workspace_id = $2",
      [draftId, workspaceId],
    );
    if (!draft) {
      throw notFound("content draft not found");
    }
    await assertMediaAssetsExist(deps.db, workspaceId, input.media_asset_ids);

    const existing = Array.isArray(draft.media_asset_ids_json) ? draft.media_asset_ids_json : [];
    const nextIds = Array.from(new Set([...existing, ...input.media_asset_ids]));

    return deps.db.one(
      `
        UPDATE content_drafts
        SET media_asset_ids_json = $1::jsonb,
          updated_at = now()
        WHERE id = $2 AND workspace_id = $3
        RETURNING *
      `,
      [JSON.stringify(nextIds), draftId, workspaceId],
    );
  });

  app.post("/v1/workspaces/:workspaceId/ugc-briefs/:briefId/generate-drafts", async (request) => {
    const { workspaceId, briefId } = request.params as { workspaceId: string; briefId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(generateUgcDraftsBody, request.body);

    await assertAiDraftUsageAvailable(deps.db, workspaceId, input.channels.length);
    const brief = await deps.db.one<{
      id: string;
      agency_client_id: string | null;
      project_id: string | null;
      campaign_id: string | null;
      title: string;
      product_or_offer: string;
      target_audience: string;
      hooks_json: string[];
      talking_points_json: string[];
      do_not_say_json: string[];
      deliverables_json: unknown[];
    }>("SELECT * FROM ugc_briefs WHERE id = $1 AND workspace_id = $2", [briefId, workspaceId]);
    if (!brief) {
      throw notFound("UGC brief not found");
    }

    return deps.db.tx(async (client) => {
      const created = [];
      for (const channel of input.channels) {
        const draft = await client.query(
          `
            INSERT INTO content_drafts (
              workspace_id,
              project_id,
              agency_client_id,
              campaign_id,
              user_id,
              mode,
              channel,
              type,
              title,
              hook,
              content,
              status,
              target_audience,
              purpose,
              generated_by_ai,
              reason_this_works,
              suggested_visual,
              source_note_ids_json,
              media_asset_ids_json,
              claims_used_json,
              missing_info_json,
              risk_notes
            )
            VALUES ($1, $2, $3, $4, $5, 'agency', $6, 'script', $7, $8, $9, 'needs_review', $10, 'UGC creative brief', true, $11, $12, '[]'::jsonb, '[]'::jsonb, $13::jsonb, $14::jsonb, $15)
            RETURNING *
          `,
          [
            workspaceId,
            brief.project_id,
            brief.agency_client_id,
            brief.campaign_id,
            request.authUser.id,
            channel,
            `${brief.title} - ${channel.replace("_", " ")} script`,
            brief.hooks_json[0] ?? "A quick story from real product use.",
            formatUgcDraftContent(brief, channel),
            brief.target_audience,
            "Generated from an approved SocialOps UGC brief with platform-specific deliverables.",
            `Use approved brand/product visuals or generate a ${channel} thumbnail after human review.`,
            JSON.stringify([brief.product_or_offer].filter(Boolean)),
            JSON.stringify(brief.do_not_say_json.length > 0 ? [] : ["ugc_brief.do_not_say_json"]),
            brief.do_not_say_json.length > 0 ? `Avoid: ${brief.do_not_say_json.join("; ")}` : "No UGC do-not-say list was provided.",
          ],
        );
        created.push(draft.rows[0]);
      }

      await client.query(
        `
          INSERT INTO usage_events (workspace_id, user_id, event_type, quantity, metadata_json)
          VALUES ($1, $2, 'ai_draft', $3, $4::jsonb)
        `,
        [
          workspaceId,
          request.authUser.id,
          input.channels.length,
          JSON.stringify({
            source: "ugc_brief",
            ugc_brief_id: briefId,
            channels: input.channels,
          }),
        ],
      );

      return { drafts: created };
    });
  });

  app.post("/v1/workspaces/:workspaceId/content-drafts/:draftId/openpost", async (request) => {
    const { workspaceId, draftId } = request.params as { workspaceId: string; draftId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    if (!deps.openPost) {
      throw badRequest("OpenPost bridge is not configured");
    }
    const input = parseBody(openPostSyncBody, request.body);
    const draft = await deps.db.one<{
      id: string;
      workspace_id: string;
      project_id: string | null;
      mode: string;
      channel: string;
      type: string;
      content: string;
      status: string;
      target_audience: string;
      purpose: string;
      source_note_ids_json: string[];
      media_asset_ids_json: string[];
      claims_used_json: string[];
      missing_info_json: string[];
      risk_notes: string;
    }>(
      `
        SELECT *
        FROM content_drafts
        WHERE id = $1 AND workspace_id = $2
      `,
      [draftId, workspaceId],
    );
    if (!draft) {
      throw notFound("content draft not found");
    }
    if (draft.status !== "approved") {
      throw badRequest("only approved drafts can be synced to OpenPost");
    }
    if (input.scheduled_at && input.social_account_ids.length === 0) {
      throw badRequest("scheduled OpenPost drafts require at least one social account");
    }

    const openPostPost = await deps.openPost.createPost({
      userId: input.openpost_user_id,
      userEmail: request.authUser.email,
      workspaceId: input.openpost_workspace_id,
      projectId: draft.project_id,
      content: draft.content,
      scheduledAt: input.scheduled_at ?? null,
      socialAccountIds: input.social_account_ids,
      randomDelayMinutes: input.random_delay_minutes,
      sourceDraftId: draft.id,
      sourceNoteIds: draft.source_note_ids_json,
      mediaAssetIds: draft.media_asset_ids_json,
      mode: draft.mode,
      channel: draft.channel,
      contentType: draft.type,
      targetAudience: draft.target_audience,
      purpose: draft.purpose,
      claimsUsed: draft.claims_used_json,
      missingInfo: draft.missing_info_json,
      riskNotes: draft.risk_notes,
    });

    const nextStatus = input.scheduled_at ? "scheduled" : "approved";
    const updated = await deps.db.one(
      `
        UPDATE content_drafts
        SET openpost_post_id = $1,
          status = $2,
          scheduled_for = COALESCE($3::timestamptz, scheduled_for),
          updated_at = now()
        WHERE id = $4 AND workspace_id = $5
        RETURNING *
      `,
      [openPostPost.id, nextStatus, input.scheduled_at ?? null, draftId, workspaceId],
    );

    return {
      draft: updated,
      openpost: openPostPost,
    };
  });

  app.get("/v1/workspaces/:workspaceId/visuals", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM visual_assets WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/visuals", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(visualAssetBody, request.body);
    const preset = input.workflow_key ? getComfyWorkflowPreset(input.workflow_key) : undefined;
    if (input.workflow_key && !preset && !input.workflow_key.startsWith("custom:")) {
      throw badRequest("unknown ComfyUI workflow_key; use a first-party preset key or prefix custom workflows with custom:");
    }
    const mediaKind = preset?.mediaKind ?? inferComfyMediaKind(input.type);
    const mediaRuntimeProfile = deps.mediaRuntimeProfile ?? "macbook_local";

    if (input.project_id) {
      const project = await deps.db.one("SELECT id FROM projects WHERE id = $1 AND workspace_id = $2", [input.project_id, workspaceId]);
      if (!project) {
        throw notFound("project not found");
      }
    }

    if (input.content_draft_id) {
      const draft = await deps.db.one("SELECT id FROM content_drafts WHERE id = $1 AND workspace_id = $2", [input.content_draft_id, workspaceId]);
      if (!draft) {
        throw notFound("content draft not found");
      }
    }

    let externalJobId: string | null = null;
    let status = "draft";
    let externalProvider: string | null = null;
    let error: string | null = null;

    if (input.queue_now && (input.workflow_json || preset)) {
      if (!deps.visualWorker && !deps.comfyUi) {
        throw badRequest("Visual worker bridge is not configured");
      }
      if (preset && !canQueueComfyPreset(preset, mediaRuntimeProfile, deps.allowHeavyMediaWorkflows ?? false)) {
        throw badRequest(
          `${preset.key} requires ${preset.runtimeClass}; current media runtime profile is ${mediaRuntimeProfile}. Save it as a draft or enable a GPU/cloud runtime.`,
        );
      }
      if (!preset && input.workflow_key.startsWith("custom:") && !(deps.allowHeavyMediaWorkflows ?? false)) {
        throw badRequest("custom ComfyUI workflows require SOCIALOPS_ALLOW_HEAVY_MEDIA_WORKFLOWS=true before queueing");
      }
      await assertVisualGenerationUsageAvailable(deps.db, workspaceId, 1);
      try {
        if (deps.visualWorker) {
          const queued = await deps.visualWorker.generate({
            visualJobId: randomUUID(),
            templateKey: input.workflow_key,
            prompt: input.prompt,
            workflow: input.workflow_json ?? undefined,
          });
          externalJobId = queued.promptId;
          externalProvider = "visual-worker";
          status = "generating";
        } else if (deps.comfyUi) {
          if (!input.workflow_json) {
            throw badRequest("direct ComfyUI queueing requires workflow_json; configure visual-worker for allowlisted template queueing");
          }
          const queued = await deps.comfyUi.queuePrompt({
            workflow: input.workflow_json,
            clientId: `socialops:${workspaceId}`,
            extraData: {
              socialops: {
                workspace_id: workspaceId,
                user_id: request.authUser.id,
                project_id: input.project_id ?? null,
                content_draft_id: input.content_draft_id ?? null,
                visual_type: input.type,
              },
            },
          });
          externalJobId = queued.prompt_id;
          externalProvider = "comfyui";
          status = queued.error ? "failed" : "generating";
          error = queued.error ? JSON.stringify(queued.error) : null;
        }
      } catch (caught) {
        externalProvider = deps.visualWorker ? "visual-worker" : "comfyui";
        status = "failed";
        error = caught instanceof Error ? caught.message : String(caught);
      }
    }

    return deps.db.tx(async (client) => {
      const asset = await client.query(
        `
          INSERT INTO visual_assets (
            workspace_id,
            user_id,
            project_id,
            content_draft_id,
            type,
            media_kind,
            prompt,
            workflow_key,
            workflow_json,
            external_provider,
            external_job_id,
            status,
            error
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13)
          RETURNING *
        `,
        [
          workspaceId,
          request.authUser.id,
          input.project_id ?? null,
          input.content_draft_id ?? null,
          input.type,
          mediaKind,
          input.prompt,
          input.workflow_key,
          input.workflow_json ? JSON.stringify(input.workflow_json) : null,
          externalProvider,
          externalJobId,
          status,
          error,
        ],
      );

      if (externalJobId) {
        await client.query(
          `
            INSERT INTO usage_events (workspace_id, user_id, event_type, quantity, metadata_json)
            VALUES ($1, $2, 'visual_generation', 1, $3::jsonb)
          `,
          [
            workspaceId,
            request.authUser.id,
            JSON.stringify({
              provider: "comfyui",
              external_job_id: externalJobId,
              type: input.type,
              workflow_key: input.workflow_key,
            }),
          ],
        );
      }

      return asset.rows[0];
    });
  });

  app.post("/v1/workspaces/:workspaceId/visuals/:assetId/poll", async (request) => {
    const { workspaceId, assetId } = request.params as { workspaceId: string; assetId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    if (!deps.visualWorker) {
      throw badRequest("Visual worker bridge is not configured");
    }

    const asset = await deps.db.one<{
      id: string;
      external_provider?: string | null;
      external_job_id?: string | null;
      status: string;
    }>(
      `
        SELECT id, external_provider, external_job_id, status
        FROM visual_assets
        WHERE id = $1 AND workspace_id = $2
      `,
      [assetId, workspaceId],
    );
    if (!asset) {
      throw notFound("visual asset not found");
    }
    if (!asset.external_job_id) {
      throw badRequest("visual asset does not have an external job id");
    }

    const polled = await deps.visualWorker.poll({
      visualJobId: asset.id,
      promptId: asset.external_job_id,
    });

    if (polled.status !== "generated" || polled.outputs.length === 0) {
      return {
        asset,
        poll: polled,
      };
    }

    const output = polled.outputs[0];
    const updated = await deps.db.one(
      `
        UPDATE visual_assets
        SET status = 'generated',
          output_url = $1,
          error = NULL,
          updated_at = now()
        WHERE id = $2 AND workspace_id = $3
        RETURNING *
      `,
      [output.publicUrl ?? output.storagePath, assetId, workspaceId],
    );

    return {
      asset: updated,
      poll: polled,
    };
  });

  app.get("/v1/workspaces/:workspaceId/videos/scripts", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM video_scripts WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/videos/script", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(videoScriptBody, request.body);

    let draft:
      | {
          id: string;
          project_id?: string | null;
          title?: string;
          hook?: string;
          content: string;
          target_audience?: string;
          purpose?: string;
        }
      | undefined;
    if (input.content_draft_id) {
      draft = await deps.db.one(
        `
          SELECT id, project_id, title, hook, content, target_audience, purpose
          FROM content_drafts
          WHERE id = $1 AND workspace_id = $2
        `,
        [input.content_draft_id, workspaceId],
      );
      if (!draft) {
        throw notFound("content draft not found");
      }
    }

    const projectId = input.project_id ?? draft?.project_id ?? null;
    let project: GenerationProject | null = null;
    if (projectId) {
      project = await deps.db.one<GenerationProject>(
        `
          SELECT id, name, type, description, stage, approved_claims_json, forbidden_claims_json, content_pillars_json
          FROM projects
          WHERE id = $1 AND workspace_id = $2
        `,
        [projectId, workspaceId],
      ) ?? null;
      if (!project) {
        throw notFound("project not found");
      }
    }

    const notes =
      input.source_note_ids.length > 0
        ? await deps.db.query<GenerationNote>(
            `
              SELECT id, type, content, created_at
              FROM capture_notes
              WHERE workspace_id = $1
                AND id = ANY($2::uuid[])
              ORDER BY created_at DESC
            `,
            [workspaceId, input.source_note_ids],
          )
        : await deps.db.query<GenerationNote>(
            `
              SELECT id, type, content, created_at
              FROM capture_notes
              WHERE workspace_id = $1
              ORDER BY created_at DESC
              LIMIT 5
            `,
            [workspaceId],
          );

    await assertAiDraftUsageAvailable(deps.db, workspaceId, 1);
    const generated = generateVideoScriptFromSource({
      platform: input.platform,
      mode: input.mode,
      videoType: input.video_type,
      durationSeconds: input.duration_seconds,
      contentDraft: draft ?? null,
      project,
      notes,
    });

    const script = await deps.db.one(
      `
        INSERT INTO video_scripts (
          user_id,
          workspace_id,
          project_id,
          content_draft_id,
          title,
          platform,
          mode,
          hook,
          script,
          scenes_json,
          captions_json,
          shot_list_json,
          voiceover_text,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13, 'draft')
        RETURNING *
      `,
      [
        request.authUser.id,
        workspaceId,
        projectId,
        input.content_draft_id ?? null,
        generated.title,
        generated.platform,
        generated.mode,
        generated.hook,
        generated.script,
        JSON.stringify(generated.scenes_json),
        JSON.stringify(generated.captions_json),
        JSON.stringify(generated.shot_list_json),
        generated.voiceover_text,
      ],
    );
    await deps.db.one(
      `
        INSERT INTO usage_events (workspace_id, user_id, event_type, quantity, metadata_json)
        VALUES ($1, $2, 'video_script', 1, $3::jsonb)
        RETURNING id
      `,
      [
        workspaceId,
        request.authUser.id,
        JSON.stringify({
          platform: input.platform,
          mode: input.mode,
          video_type: input.video_type,
          content_draft_id: input.content_draft_id ?? null,
        }),
      ],
    );
    return script;
  });

  app.post("/v1/workspaces/:workspaceId/videos/scripts/:scriptId/approval", async (request) => {
    const { workspaceId, scriptId } = request.params as { workspaceId: string; scriptId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(videoApprovalBody, request.body);
    const nextStatus = input.action === "approve" ? "approved" : "rejected";
    const updated = await deps.db.one(
      `
        UPDATE video_scripts
        SET status = $1,
          updated_at = now()
        WHERE id = $2 AND workspace_id = $3
        RETURNING *
      `,
      [nextStatus, scriptId, workspaceId],
    );
    if (!updated) {
      throw notFound("video script not found");
    }
    return updated;
  });

  app.get("/v1/workspaces/:workspaceId/videos/jobs/:jobId", async (request) => {
    const { workspaceId, jobId } = request.params as { workspaceId: string; jobId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    const job = await deps.db.one("SELECT * FROM video_jobs WHERE id = $1 AND workspace_id = $2", [jobId, workspaceId]);
    if (!job) {
      throw notFound("video job not found");
    }
    return job;
  });

  app.post("/v1/workspaces/:workspaceId/videos/jobs", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(videoJobBody, request.body);

    let videoScript:
      | {
          id: string;
          project_id?: string | null;
          content_draft_id?: string | null;
          status: string;
        }
      | undefined;
    if (input.video_script_id) {
      videoScript = await deps.db.one(
        `
          SELECT id, project_id, content_draft_id, status
          FROM video_scripts
          WHERE id = $1 AND workspace_id = $2
        `,
        [input.video_script_id, workspaceId],
      );
      if (!videoScript) {
        throw notFound("video script not found");
      }
      if (videoScript.status !== "approved") {
        throw badRequest("video script must be approved before creating a render job");
      }
    }

    const projectId = input.project_id ?? videoScript?.project_id ?? null;
    const contentDraftId = input.content_draft_id ?? videoScript?.content_draft_id ?? null;
    if (projectId) {
      await assertWorkspaceReferenceExists(deps.db, workspaceId, "projects", projectId, "project not found");
    }
    if (contentDraftId) {
      const draft = await deps.db.one("SELECT id FROM content_drafts WHERE id = $1 AND workspace_id = $2", [contentDraftId, workspaceId]);
      if (!draft) {
        throw notFound("content draft not found");
      }
    }

    return deps.db.one(
      `
        INSERT INTO video_jobs (
          user_id,
          workspace_id,
          project_id,
          content_draft_id,
          video_script_id,
          template_key,
          status,
          render_provider,
          aspect_ratio
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'queued', $7, $8)
        RETURNING *
      `,
      [
        request.authUser.id,
        workspaceId,
        projectId,
        contentDraftId,
        input.video_script_id ?? null,
        input.template_key,
        input.render_provider,
        input.aspect_ratio,
      ],
    );
  });

  app.post("/v1/workspaces/:workspaceId/videos/jobs/:jobId/render", async (request) => {
    const { workspaceId, jobId } = request.params as { workspaceId: string; jobId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    parseBody(videoRenderBody, request.body);
    const job = await deps.db.one<{
      id: string;
      status: string;
      render_provider: string;
      template_key: string;
      aspect_ratio: "9:16" | "16:9" | "1:1" | "4:5";
      title?: string | null;
      hook?: string | null;
      scenes_json?: unknown[];
      captions_json?: unknown[];
    }>(
      `
        SELECT
          video_jobs.id,
          video_jobs.status,
          video_jobs.render_provider,
          video_jobs.template_key,
          video_jobs.aspect_ratio,
          video_scripts.title,
          video_scripts.hook,
          video_scripts.scenes_json,
          video_scripts.captions_json
        FROM video_jobs
        LEFT JOIN video_scripts ON video_scripts.id = video_jobs.video_script_id
        WHERE video_jobs.id = $1 AND video_jobs.workspace_id = $2
      `,
      [jobId, workspaceId],
    );
    if (!job) {
      throw notFound("video job not found");
    }
    if (!["queued", "planning", "generating_assets", "failed"].includes(job.status)) {
      throw badRequest(`cannot render video job from ${job.status}`);
    }
    if (job.render_provider !== "manual") {
      await assertVideoRenderUsageAvailable(deps.db, workspaceId, 1);
    }
    if (deps.videoWorker && ["remotion", "ffmpeg"].includes(job.render_provider)) {
      const rendered = await deps.videoWorker.assemble({
        videoJobId: job.id,
        aspectRatio: job.aspect_ratio,
        title: job.title ?? "SocialOps Video",
        hook: job.hook ?? "Turn your work into content.",
        scenes: mapVideoScriptScenesToAssembler(job.scenes_json ?? []),
        captions: mapVideoScriptCaptionsToAssembler(job.captions_json ?? []),
      });

      return deps.db.tx(async (client) => {
        const asset = await client.query(
          `
            INSERT INTO video_assets (
              user_id,
              workspace_id,
              video_job_id,
              file_name,
              mime_type,
              storage_path,
              public_url,
              duration_seconds,
              width,
              height,
              status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'rendered')
            RETURNING *
          `,
          [
            request.authUser.id,
            workspaceId,
            job.id,
            rendered.fileName,
            rendered.mimeType,
            rendered.storagePath,
            rendered.publicUrl,
            rendered.durationSeconds,
            rendered.width,
            rendered.height,
          ],
        );
        const updated = await client.query(
          `
            UPDATE video_jobs
            SET status = 'rendered',
              duration_seconds = $1,
              error = NULL,
              updated_at = now()
            WHERE id = $2 AND workspace_id = $3
            RETURNING *
          `,
          [rendered.durationSeconds, job.id, workspaceId],
        );
        await client.query(
          `
            INSERT INTO usage_events (workspace_id, user_id, event_type, quantity, metadata_json)
            VALUES ($1, $2, 'video_render', 1, $3::jsonb)
          `,
          [
            workspaceId,
            request.authUser.id,
            JSON.stringify({
              video_job_id: jobId,
              render_provider: job.render_provider,
              video_asset_id: asset.rows[0]?.id,
            }),
          ],
        );

        return {
          job: updated.rows[0],
          asset: asset.rows[0],
          render: rendered,
        };
      });
    }

    const updated = await deps.db.one(
      `
        UPDATE video_jobs
        SET status = 'rendering',
          error = NULL,
          updated_at = now()
        WHERE id = $1 AND workspace_id = $2
        RETURNING *
      `,
      [jobId, workspaceId],
    );
    await deps.db.one(
      `
        INSERT INTO usage_events (workspace_id, user_id, event_type, quantity, metadata_json)
        VALUES ($1, $2, 'video_render', 1, $3::jsonb)
        RETURNING id
      `,
      [
        workspaceId,
        request.authUser.id,
        JSON.stringify({
          video_job_id: jobId,
          render_provider: job.render_provider,
        }),
      ],
    );
    return updated;
  });

  app.get("/v1/workspaces/:workspaceId/videos/assets", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM video_assets WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100", [workspaceId]);
  });

  app.get("/v1/workspaces/:workspaceId/videos/assets/:assetId/export-package", async (request) => {
    const { workspaceId, assetId } = request.params as { workspaceId: string; assetId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    const row = await deps.db.one<VideoExportPackageRow>(
      `
        SELECT
          video_assets.id,
          video_assets.file_name,
          video_assets.mime_type,
          video_assets.storage_path,
          video_assets.public_url,
          video_assets.duration_seconds,
          video_assets.width,
          video_assets.height,
          video_assets.status,
          video_assets.video_job_id,
          content_drafts.id AS draft_id,
          content_drafts.title AS draft_title,
          content_drafts.hook AS draft_hook,
          content_drafts.content AS draft_content,
          content_drafts.channel AS draft_channel,
          content_drafts.type AS draft_type,
          content_drafts.status AS draft_status,
          content_drafts.target_audience AS draft_target_audience,
          content_drafts.purpose AS draft_purpose,
          video_scripts.title AS script_title,
          video_scripts.hook AS script_hook,
          video_scripts.platform AS script_platform,
          video_scripts.status AS script_status,
          video_scripts.captions_json AS script_captions_json
        FROM video_assets
        LEFT JOIN video_jobs ON video_jobs.id = video_assets.video_job_id
        LEFT JOIN content_drafts ON content_drafts.id = video_jobs.content_draft_id
        LEFT JOIN video_scripts ON video_scripts.id = video_jobs.video_script_id
        WHERE video_assets.id = $1 AND video_assets.workspace_id = $2
      `,
      [assetId, workspaceId],
    );
    if (!row) {
      throw notFound("video asset not found");
    }

    const assetApproved = ["approved", "used"].includes(row.status);
    const draftApproved = row.draft_status === "approved" || row.draft_status === "scheduled" || row.draft_status === "manually_published";
    const blockedBy = [
      ...(assetApproved ? [] : ["Approve the rendered video asset before manual upload."]),
      ...(row.draft_id && !draftApproved ? ["Approve the source content draft before publishing or uploading manually."] : []),
      ...(row.draft_id ? [] : ["Attach the video to a content draft so the export has approved post copy."]),
    ];
    const platform = row.draft_channel ?? row.script_platform ?? "manual";

    return {
      asset: {
        id: row.id,
        file_name: row.file_name,
        mime_type: row.mime_type,
        storage_path: row.storage_path,
        public_url: row.public_url ?? null,
        duration_seconds: row.duration_seconds ?? null,
        width: row.width ?? null,
        height: row.height ?? null,
        status: row.status,
      },
      content_draft: row.draft_id
        ? {
            id: row.draft_id,
            title: row.draft_title ?? "",
            hook: row.draft_hook ?? "",
            content: row.draft_content ?? "",
            channel: row.draft_channel ?? "",
            type: row.draft_type ?? "",
            status: row.draft_status ?? "",
            target_audience: row.draft_target_audience ?? "",
            purpose: row.draft_purpose ?? "",
          }
        : null,
      post_copy: row.draft_content ?? row.script_hook ?? "",
      caption_text: buildCaptionText(row.script_captions_json),
      manual_upload: {
        platform,
        required: true,
        ready: blockedBy.length === 0,
        blocked_by: blockedBy,
        instructions: manualVideoUploadInstructions(platform),
        checklist: [
          "Review the final MP4 in SocialOps.",
          "Confirm the draft and video are approved by a human.",
          "Use the post copy exactly as approved, or edit and re-approve before posting.",
          "Upload manually on the target platform when direct API posting is unavailable or unsafe.",
          "Return to SocialOps and mark the draft manually published after posting.",
        ],
      },
      compliance: {
        human_approval_required: true,
        no_auto_posting: true,
        no_browser_automation: true,
        no_auto_dm: true,
      },
    };
  });

  app.post("/v1/workspaces/:workspaceId/videos/assets/:assetId/approval", async (request) => {
    const { workspaceId, assetId } = request.params as { workspaceId: string; assetId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(videoApprovalBody, request.body);
    const nextStatus = input.action === "approve" ? "approved" : "rejected";
    const asset = await deps.db.one(
      `
        UPDATE video_assets
        SET status = $1
        WHERE id = $2 AND workspace_id = $3
        RETURNING *
      `,
      [nextStatus, assetId, workspaceId],
    );
    if (!asset) {
      throw notFound("video asset not found");
    }
    return asset;
  });

  app.post("/v1/workspaces/:workspaceId/videos/assets/:assetId/attach-to-draft", async (request) => {
    const { workspaceId, assetId } = request.params as { workspaceId: string; assetId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(videoAssetAttachBody, request.body);
    const asset = await deps.db.one<{
      id: string;
      user_id: string;
      workspace_id: string;
      video_job_id: string;
      file_name: string;
      mime_type: string;
      storage_path: string;
      public_url?: string | null;
      duration_seconds?: number | null;
      width?: number | null;
      height?: number | null;
      status: string;
      content_draft_id?: string | null;
    }>(
      `
        SELECT
          video_assets.*,
          video_jobs.content_draft_id
        FROM video_assets
        LEFT JOIN video_jobs ON video_jobs.id = video_assets.video_job_id
        WHERE video_assets.id = $1 AND video_assets.workspace_id = $2
      `,
      [assetId, workspaceId],
    );
    if (!asset) {
      throw notFound("video asset not found");
    }
    if (asset.status !== "approved") {
      throw badRequest("video asset must be approved before attaching to a draft");
    }

    const draftId = input.content_draft_id ?? asset.content_draft_id;
    if (!draftId) {
      throw badRequest("content_draft_id is required");
    }

    const draft = await deps.db.one<{ id: string; media_asset_ids_json: string[] }>(
      "SELECT id, media_asset_ids_json FROM content_drafts WHERE id = $1 AND workspace_id = $2",
      [draftId, workspaceId],
    );
    if (!draft) {
      throw notFound("content draft not found");
    }

    return deps.db.tx(async (client) => {
      const media = await client.query(
        `
          INSERT INTO media_assets (
            workspace_id,
            user_id,
            source,
            media_kind,
            title,
            url,
            metadata_json,
            rights_json,
            status
          )
          VALUES ($1, $2, 'remotion', 'video', $3, $4, $5::jsonb, '{}'::jsonb, 'approved')
          RETURNING *
        `,
        [
          workspaceId,
          request.authUser.id,
          asset.file_name,
          asset.public_url ?? asset.storage_path,
          JSON.stringify({
            video_asset_id: asset.id,
            video_job_id: asset.video_job_id,
            storage_path: asset.storage_path,
            duration_seconds: asset.duration_seconds ?? null,
            width: asset.width ?? null,
            height: asset.height ?? null,
          }),
        ],
      );
      const mediaAsset = media.rows[0] as { id: string };
      const existing = Array.isArray(draft.media_asset_ids_json) ? draft.media_asset_ids_json : [];
      const nextIds = Array.from(new Set([...existing, mediaAsset.id]));
      const updatedDraft = await client.query(
        `
          UPDATE content_drafts
          SET media_asset_ids_json = $1::jsonb,
            updated_at = now()
          WHERE id = $2 AND workspace_id = $3
          RETURNING *
        `,
        [JSON.stringify(nextIds), draftId, workspaceId],
      );
      const bridge = await client.query(
        `
          INSERT INTO video_post_bridges (
            video_asset_id,
            content_draft_id,
            status
          )
          VALUES ($1, $2, 'attached')
          RETURNING *
        `,
        [asset.id, draftId],
      );
      const updatedAsset = await client.query(
        `
          UPDATE video_assets
          SET status = 'used'
          WHERE id = $1 AND workspace_id = $2
          RETURNING *
        `,
        [asset.id, workspaceId],
      );

      return {
        video_asset: updatedAsset.rows[0],
        media_asset: media.rows[0],
        draft: updatedDraft.rows[0],
        bridge: bridge.rows[0],
      };
    });
  });

  app.post("/v1/workspaces/:workspaceId/videos/assets/:assetId/send-to-openpost", async (request) => {
    const { workspaceId, assetId } = request.params as { workspaceId: string; assetId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    if (!deps.openPost) {
      throw badRequest("OpenPost bridge is not configured");
    }
    const input = parseBody(openPostSyncBody, request.body);
    const row = await deps.db.one<VideoOpenPostBridgeRow>(
      `
        SELECT
          video_assets.id AS asset_id,
          video_assets.status AS asset_status,
          video_post_bridges.id AS bridge_id,
          content_drafts.id AS draft_id,
          content_drafts.project_id,
          content_drafts.mode,
          content_drafts.channel,
          content_drafts.type,
          content_drafts.content,
          content_drafts.status AS draft_status,
          content_drafts.target_audience,
          content_drafts.purpose,
          content_drafts.source_note_ids_json,
          content_drafts.media_asset_ids_json,
          content_drafts.claims_used_json,
          content_drafts.missing_info_json,
          content_drafts.risk_notes
        FROM video_assets
        LEFT JOIN video_post_bridges ON video_post_bridges.video_asset_id = video_assets.id
        LEFT JOIN content_drafts ON content_drafts.id = video_post_bridges.content_draft_id
        WHERE video_assets.id = $1 AND video_assets.workspace_id = $2
        ORDER BY video_post_bridges.created_at DESC NULLS LAST
        LIMIT 1
      `,
      [assetId, workspaceId],
    );
    if (!row) {
      throw notFound("video asset not found");
    }
    if (row.asset_status !== "used") {
      throw badRequest("attach the approved video asset to a content draft before sending to OpenPost");
    }
    if (!row.bridge_id || !row.draft_id) {
      throw badRequest("video asset must be attached to a content draft before OpenPost handoff");
    }
    if (row.draft_status !== "approved") {
      throw badRequest("only approved drafts can be synced to OpenPost");
    }
    if (input.scheduled_at && input.social_account_ids.length === 0) {
      throw badRequest("scheduled OpenPost drafts require at least one social account");
    }

    const openPostPost = await deps.openPost.createPost({
      userId: input.openpost_user_id,
      userEmail: request.authUser.email,
      workspaceId: input.openpost_workspace_id,
      projectId: row.project_id ?? null,
      content: row.content ?? "",
      scheduledAt: input.scheduled_at ?? null,
      socialAccountIds: input.social_account_ids,
      randomDelayMinutes: input.random_delay_minutes,
      sourceDraftId: row.draft_id,
      sourceNoteIds: row.source_note_ids_json ?? [],
      mediaAssetIds: row.media_asset_ids_json ?? [],
      mode: row.mode ?? "",
      channel: row.channel ?? "",
      contentType: row.type ?? "",
      targetAudience: row.target_audience ?? "",
      purpose: row.purpose ?? "",
      claimsUsed: row.claims_used_json ?? [],
      missingInfo: row.missing_info_json ?? [],
      riskNotes: row.risk_notes ?? "",
    });

    return deps.db.tx(async (client) => {
      const nextDraftStatus = input.scheduled_at ? "scheduled" : "approved";
      const nextBridgeStatus = input.scheduled_at ? "scheduled" : "attached";
      const updatedDraft = await client.query(
        `
          UPDATE content_drafts
          SET openpost_post_id = $1,
            status = $2,
            scheduled_for = COALESCE($3::timestamptz, scheduled_for),
            updated_at = now()
          WHERE id = $4 AND workspace_id = $5
          RETURNING *
        `,
        [openPostPost.id, nextDraftStatus, input.scheduled_at ?? null, row.draft_id, workspaceId],
      );
      const updatedBridge = await client.query(
        `
          UPDATE video_post_bridges
          SET openpost_post_id = $1,
            status = $2,
            updated_at = now()
          WHERE id = $3
          RETURNING *
        `,
        [openPostPost.id, nextBridgeStatus, row.bridge_id],
      );

      return {
        draft: updatedDraft.rows[0],
        bridge: updatedBridge.rows[0],
        openpost: openPostPost,
      };
    });
  });

  app.get("/v1/workspaces/:workspaceId/decks", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM decks WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/decks", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(deckBody, request.body);

    await assertWorkspaceReferenceExists(deps.db, workspaceId, "projects", input.project_id, "project not found");

    return deps.db.one(
      `
        INSERT INTO decks (
          workspace_id,
          user_id,
          project_id,
          type,
          title,
          slides_json,
          markdown,
          renderer,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
        RETURNING *
      `,
      [
        workspaceId,
        request.authUser.id,
        input.project_id ?? null,
        input.type,
        input.title,
        JSON.stringify(input.slides_json),
        input.markdown,
        input.renderer,
        input.status,
      ],
    );
  });

  app.post("/v1/workspaces/:workspaceId/decks/:deckId/approval", async (request) => {
    const { workspaceId, deckId } = request.params as { workspaceId: string; deckId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(approvalBody, request.body);
    const nextStatus = input.action === "approve" ? "approved" : "rejected";

    return deps.db.tx(async (client) => {
      const updated = await client.query(
        `
          UPDATE decks
          SET status = $1,
            updated_at = now()
          WHERE id = $2 AND workspace_id = $3
          RETURNING *
        `,
        [nextStatus, deckId, workspaceId],
      );
      if (!updated.rows[0]) {
        throw notFound("deck not found");
      }

      await client.query(
        `
          INSERT INTO approval_items (workspace_id, item_type, item_id, requested_action, status, reviewer_user_id, reviewer_note)
          VALUES ($1, 'deck', $2, 'export', $3, $4, $5)
        `,
        [workspaceId, deckId, nextStatus === "approved" ? "approved" : "rejected", request.authUser.id, input.reviewer_note ?? null],
      );

      return updated.rows[0];
    });
  });

  app.post("/v1/workspaces/:workspaceId/decks/:deckId/render", async (request) => {
    const { workspaceId, deckId } = request.params as { workspaceId: string; deckId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    if (!deps.deckWorker) {
      throw badRequest("Deck worker bridge is not configured");
    }
    const input = parseBody(deckRenderBody, request.body);
    const deck = await deps.db.one<{
      id: string;
      title: string;
      markdown: string;
      renderer: "marp" | "slidev";
      status: string;
    }>(
      `
        SELECT id, title, markdown, renderer, status
        FROM decks
        WHERE id = $1 AND workspace_id = $2
      `,
      [deckId, workspaceId],
    );
    if (!deck) {
      throw notFound("deck not found");
    }
    if (deck.status !== "approved" && !input.dry_run) {
      throw badRequest("deck must be approved before rendering an export");
    }

    await assertDeckExportUsageAvailable(deps.db, workspaceId, 1);
    const rendered = await deps.deckWorker.render({
      deckId: deck.id,
      renderer: deck.renderer,
      markdown: deck.markdown,
      format: input.format,
      dryRun: input.dry_run,
    });

    return deps.db.tx(async (client) => {
      const updated = await client.query(
        `
          UPDATE decks
          SET status = 'rendered',
            export_url = $1,
            updated_at = now()
          WHERE id = $2 AND workspace_id = $3
          RETURNING *
        `,
        [rendered.publicUrl ?? rendered.storagePath, deck.id, workspaceId],
      );
      await client.query(
        `
          INSERT INTO usage_events (workspace_id, user_id, event_type, quantity, metadata_json)
          VALUES ($1, $2, 'deck_export', 1, $3::jsonb)
        `,
        [
          workspaceId,
          request.authUser.id,
          JSON.stringify({
            deck_id: deck.id,
            renderer: deck.renderer,
            format: input.format,
            dry_run: input.dry_run,
          }),
        ],
      );

      return {
        deck: updated.rows[0],
        render: rendered,
      };
    });
  });

  app.get("/v1/workspaces/:workspaceId/research-briefs", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM research_briefs WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 100", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/research-briefs", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(researchBriefBody, request.body);

    if (!deps.pokeeResearch) {
      throw badRequest("PokeeResearch bridge is not configured");
    }

    if (input.project_id) {
      const project = await deps.db.one("SELECT id FROM projects WHERE id = $1 AND workspace_id = $2", [input.project_id, workspaceId]);
      if (!project) {
        throw notFound("project not found");
      }
    }

    if (input.source_note_id) {
      const note = await deps.db.one("SELECT id FROM capture_notes WHERE id = $1 AND workspace_id = $2", [input.source_note_id, workspaceId]);
      if (!note) {
        throw notFound("capture note not found");
      }
    }

    const query = input.question ? `${input.topic}: ${input.question}` : input.topic;
    const search = await deps.pokeeResearch.search(query);
    const searchItems = extractPokeeSearchItems(search);
    const citations = searchItems.map((item) => ({
      title: item.title ?? "",
      url: item.url ?? item.link ?? "",
      snippet: item.snippet ?? item.description ?? "",
    }));
    const firstUrl = citations.find((citation) => citation.url)?.url;
    const read = firstUrl ? await deps.pokeeResearch.read(firstUrl, input.question || input.topic) : null;
    const summary =
      read?.summary ??
      read?.content ??
      citations
        .slice(0, 3)
        .map((citation) => [citation.title, citation.snippet].filter(Boolean).join(": "))
        .filter(Boolean)
        .join("\n\n");

    return deps.db.one(
      `
        INSERT INTO research_briefs (
          workspace_id,
          user_id,
          project_id,
          source_note_id,
          topic,
          question,
          summary,
          citations_json,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, 'needs_review')
        RETURNING *
      `,
      [
        workspaceId,
        request.authUser.id,
        input.project_id ?? null,
        input.source_note_id ?? null,
        input.topic,
        input.question,
        summary,
        JSON.stringify(citations),
      ],
    );
  });

  app.post("/v1/workspaces/:workspaceId/visuals/:assetId/approval", async (request) => {
    const { workspaceId, assetId } = request.params as { workspaceId: string; assetId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(approvalBody, request.body);
    const nextStatus = input.action === "approve" ? "approved" : "rejected";

    return deps.db.tx(async (client) => {
      const updated = await client.query(
        `
          UPDATE visual_assets
          SET status = $1,
            updated_at = now()
          WHERE id = $2 AND workspace_id = $3
          RETURNING *
        `,
        [nextStatus, assetId, workspaceId],
      );
      if (!updated.rows[0]) {
        throw notFound("visual asset not found");
      }

      await client.query(
        `
          INSERT INTO approval_items (workspace_id, item_type, item_id, requested_action, status, reviewer_user_id, reviewer_note)
          VALUES ($1, 'visual_asset', $2, 'approve', $3, $4, $5)
        `,
        [workspaceId, assetId, nextStatus === "approved" ? "approved" : "rejected", request.authUser.id, input.reviewer_note ?? null],
      );

      return updated.rows[0];
    });
  });

  app.get("/v1/workspaces/:workspaceId/applications", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM applications WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 200", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/applications", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(applicationBody, request.body);
    if (input.project_id) {
      await assertWorkspaceReferenceExists(deps.db, workspaceId, "projects", input.project_id, "project not found");
    }
    return deps.db.one(
      `
        INSERT INTO applications (
          workspace_id,
          project_id,
          name,
          type,
          deadline,
          url,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `,
      [
        workspaceId,
        input.project_id ?? null,
        input.name,
        input.type,
        input.deadline ?? null,
        input.url ?? null,
        input.status,
      ],
    );
  });

  app.get("/v1/workspaces/:workspaceId/applications/:applicationId", async (request) => {
    const { workspaceId, applicationId } = request.params as { workspaceId: string; applicationId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    const application = await deps.db.one(
      "SELECT * FROM applications WHERE id = $1 AND workspace_id = $2",
      [applicationId, workspaceId],
    );
    if (!application) {
      throw notFound("application not found");
    }
    return application;
  });

  app.get("/v1/workspaces/:workspaceId/applications/:applicationId/answers", async (request) => {
    const { workspaceId, applicationId } = request.params as { workspaceId: string; applicationId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    const application = await deps.db.one(
      "SELECT id FROM applications WHERE id = $1 AND workspace_id = $2",
      [applicationId, workspaceId],
    );
    if (!application) {
      throw notFound("application not found");
    }
    return deps.db.query(
      "SELECT * FROM application_answers WHERE application_id = $1 ORDER BY created_at ASC",
      [applicationId],
    );
  });

  app.post("/v1/workspaces/:workspaceId/applications/:applicationId/answers", async (request) => {
    const { workspaceId, applicationId } = request.params as { workspaceId: string; applicationId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(applicationAnswerBody, request.body);
    const application = await deps.db.one(
      "SELECT id FROM applications WHERE id = $1 AND workspace_id = $2",
      [applicationId, workspaceId],
    );
    if (!application) {
      throw notFound("application not found");
    }
    return deps.db.one(
      `
        INSERT INTO application_answers (
          application_id,
          question,
          answer,
          status,
          missing_info_json
        )
        VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING *
      `,
      [applicationId, input.question, input.answer, input.status, JSON.stringify(input.missing_info)],
    );
  });

  app.get("/v1/workspaces/:workspaceId/leads", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query("SELECT * FROM leads WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 500", [workspaceId]);
  });

  app.post("/v1/workspaces/:workspaceId/leads", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(leadBody, request.body);
    if (input.project_id) {
      await assertWorkspaceReferenceExists(deps.db, workspaceId, "projects", input.project_id, "project not found");
    }
    return deps.db.one(
      `
        INSERT INTO leads (
          workspace_id,
          project_id,
          name,
          email,
          linkedin_url,
          x_url,
          company,
          role,
          segment,
          source,
          status,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `,
      [
        workspaceId,
        input.project_id ?? null,
        input.name,
        input.email ?? null,
        input.linkedin_url ?? null,
        input.x_url ?? null,
        input.company ?? null,
        input.role ?? null,
        input.segment,
        input.source,
        input.status,
        input.notes,
      ],
    );
  });

  app.patch("/v1/workspaces/:workspaceId/leads/:leadId", async (request) => {
    const { workspaceId, leadId } = request.params as { workspaceId: string; leadId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(leadUpdateBody, request.body);

    const updates: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;
    for (const [column, value] of Object.entries(input)) {
      if (value === undefined) {
        continue;
      }
      updates.push(`${column} = $${paramIndex}`);
      values.push(value);
      paramIndex += 1;
    }
    if (updates.length === 0) {
      throw badRequest("no fields to update");
    }
    updates.push("updated_at = now()");
    values.push(leadId, workspaceId);

    const updated = await deps.db.one(
      `UPDATE leads SET ${updates.join(", ")} WHERE id = $${paramIndex} AND workspace_id = $${paramIndex + 1} RETURNING *`,
      values,
    );
    if (!updated) {
      throw notFound("lead not found");
    }
    return updated;
  });

  app.get("/v1/workspaces/:workspaceId/outreach-messages", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    return deps.db.query(
      "SELECT * FROM outreach_messages WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT 200",
      [workspaceId],
    );
  });

  app.post("/v1/workspaces/:workspaceId/outreach-messages", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(outreachMessageBody, request.body);
    if (input.lead_id) {
      const lead = await deps.db.one("SELECT id FROM leads WHERE id = $1 AND workspace_id = $2", [input.lead_id, workspaceId]);
      if (!lead) {
        throw notFound("lead not found");
      }
    }
    const persistedStatus = input.status === "needs_review" ? "draft" : input.status;
    return deps.db.one(
      `
        INSERT INTO outreach_messages (
          workspace_id,
          lead_id,
          channel,
          subject,
          body,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `,
      [workspaceId, input.lead_id ?? null, input.channel, input.subject ?? null, input.body, persistedStatus],
    );
  });

  app.post("/v1/workspaces/:workspaceId/outreach-messages/:messageId/approval", async (request) => {
    const { workspaceId, messageId } = request.params as { workspaceId: string; messageId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(approvalBody, request.body);
    const nextStatus = input.action === "approve" ? "approved" : "archived";

    return deps.db.tx(async (client) => {
      const updated = await client.query(
        `UPDATE outreach_messages SET status = $1, updated_at = now() WHERE id = $2 AND workspace_id = $3 RETURNING *`,
        [nextStatus, messageId, workspaceId],
      );
      if (!updated.rows[0]) {
        throw notFound("outreach message not found");
      }
      await client.query(
        `INSERT INTO approval_items (workspace_id, item_type, item_id, requested_action, status, reviewer_user_id, reviewer_note)
         VALUES ($1, 'outreach_message', $2, 'send', $3, $4, $5)`,
        [workspaceId, messageId, input.action === "approve" ? "approved" : "rejected", request.authUser.id, input.reviewer_note ?? null],
      );
      return updated.rows[0];
    });
  });

  app.post("/v1/workspaces/:workspaceId/outreach-messages/:messageId/manual-sent", async (request) => {
    const { workspaceId, messageId } = request.params as { workspaceId: string; messageId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(outreachManualSentBody, request.body);
    const sentAt = input.sent_at ?? new Date().toISOString();
    const updated = await deps.db.one(
      `UPDATE outreach_messages
       SET status = 'sent', sent_at = $1, updated_at = now()
       WHERE id = $2 AND workspace_id = $3 AND status IN ('approved', 'draft')
       RETURNING *`,
      [sentAt, messageId, workspaceId],
    );
    if (!updated) {
      throw notFound("outreach message not found or not approvable");
    }
    return updated;
  });

  app.get("/v1/workspaces/:workspaceId/calendar", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor", "viewer"]);
    const input = calendarQuery.parse(request.query ?? {});
    const from = input.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const to = input.to ?? new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

    const [scheduledItems, scheduledDrafts] = await Promise.all([
      deps.db.query<{
        id: string;
        content_draft_id: string;
        platform: string;
        scheduled_for: string;
        status: string;
        draft_title?: string | null;
        draft_hook?: string | null;
        draft_channel?: string | null;
      }>(
        `SELECT
           items.id,
           items.content_draft_id,
           items.platform,
           items.scheduled_for,
           items.status,
           drafts.title AS draft_title,
           drafts.hook AS draft_hook,
           drafts.channel AS draft_channel
         FROM content_calendar_items items
         LEFT JOIN content_drafts drafts ON drafts.id = items.content_draft_id
         WHERE items.workspace_id = $1
           AND items.scheduled_for >= $2
           AND items.scheduled_for <= $3
         ORDER BY items.scheduled_for ASC`,
        [workspaceId, from, to],
      ),
      deps.db.query<{
        id: string;
        title?: string | null;
        hook?: string | null;
        channel?: string | null;
        status: string;
        scheduled_for: string;
        openpost_post_id?: string | null;
      }>(
        `SELECT id, title, hook, channel, status, scheduled_for, openpost_post_id
         FROM content_drafts
         WHERE workspace_id = $1
           AND scheduled_for IS NOT NULL
           AND scheduled_for >= $2
           AND scheduled_for <= $3
         ORDER BY scheduled_for ASC`,
        [workspaceId, from, to],
      ),
    ]);

    const items = scheduledItems.map((row) => ({
      kind: "calendar_item" as const,
      id: row.id,
      content_draft_id: row.content_draft_id,
      platform: row.platform,
      scheduled_for: row.scheduled_for,
      status: row.status,
      title: row.draft_title ?? null,
      hook: row.draft_hook ?? null,
      channel: row.draft_channel ?? row.platform,
      openpost_post_id: null as string | null,
    }));

    const drafts = scheduledDrafts.map((row) => ({
      kind: "scheduled_draft" as const,
      id: row.id,
      content_draft_id: row.id,
      platform: row.channel ?? "",
      scheduled_for: row.scheduled_for,
      status: row.status,
      title: row.title ?? null,
      hook: row.hook ?? null,
      channel: row.channel ?? "",
      openpost_post_id: row.openpost_post_id ?? null,
    }));

    const merged = [...items, ...drafts].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));

    return {
      range: { from, to },
      counts: {
        calendar_items: items.length,
        scheduled_drafts: drafts.length,
        total: merged.length,
      },
      items: merged,
    };
  });

  app.post("/v1/workspaces/:workspaceId/videos/product-demo/create", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(productDemoCreateBody, request.body);
    if (input.project_id) {
      await assertWorkspaceReferenceExists(deps.db, workspaceId, "projects", input.project_id, "project not found");
    }
    return deps.db.one(
      `
        INSERT INTO product_demo_projects (
          workspace_id,
          project_id,
          product_name,
          product_url,
          goal,
          target_audience,
          platform,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'planning')
        RETURNING *
      `,
      [
        workspaceId,
        input.project_id ?? null,
        input.product_name,
        input.product_url,
        input.goal,
        input.target_audience,
        input.platform,
      ],
    );
  });

  app.post("/v1/workspaces/:workspaceId/videos/product-demo/:demoId/plan", async (request) => {
    const { workspaceId, demoId } = request.params as { workspaceId: string; demoId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(productDemoPlanBody, request.body);

    const demo = await deps.db.one<{
      id: string;
      product_url: string;
      goal: string;
      product_name: string;
      target_audience: string;
      platform: string;
    }>(
      `SELECT id, product_url, goal, product_name, target_audience, platform
       FROM product_demo_projects WHERE id = $1 AND workspace_id = $2`,
      [demoId, workspaceId],
    );
    if (!demo) {
      throw notFound("product demo project not found");
    }

    let scenes: ProductDemoPlannedScene[];
    let plannerUsed: "user_supplied" | "miniclaw" | "default" = "default";
    if (input.scenes) {
      scenes = input.scenes;
      plannerUsed = "user_supplied";
    } else if (deps.miniClaw) {
      try {
        const planned = await deps.miniClaw.planProductDemoScenes({
          product_name: demo.product_name,
          product_url: demo.product_url,
          goal: demo.goal,
          target_audience: demo.target_audience,
          platform: demo.platform,
        });
        scenes = planned.map(coerceMiniClawScene);
        plannerUsed = "miniclaw";
      } catch (error) {
        request.log.warn({ err: error }, "MiniClaw scene planning failed, falling back to default");
        scenes = defaultDemoScenes(demo);
      }
    } else {
      scenes = defaultDemoScenes(demo);
    }

    return deps.db.tx(async (client) => {
      await client.query(`DELETE FROM product_demo_scenes WHERE demo_project_id = $1`, [demoId]);
      const inserted: unknown[] = [];
      for (const scene of scenes) {
        const row = await client.query(
          `
            INSERT INTO product_demo_scenes (
              demo_project_id,
              "order",
              url,
              action_description,
              narration,
              caption,
              duration_seconds,
              zoom_target_json
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
            RETURNING *
          `,
          [
            demoId,
            scene.order,
            scene.url,
            scene.action_description,
            scene.narration,
            scene.caption,
            scene.duration_seconds,
            JSON.stringify(scene.zoom_target_json),
          ],
        );
        inserted.push(row.rows[0]);
      }
      const updated = await client.query(
        `UPDATE product_demo_projects SET status = 'planned', updated_at = now() WHERE id = $1 RETURNING *`,
        [demoId],
      );
      return { demo: updated.rows[0], scenes: inserted, planner_used: plannerUsed };
    });
  });

  app.post("/v1/workspaces/:workspaceId/videos/product-demo/:demoId/capture", async (request) => {
    const { workspaceId, demoId } = request.params as { workspaceId: string; demoId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    if (!deps.videoWorker) {
      throw badRequest("Video worker bridge is not configured");
    }
    const input = parseBody(productDemoCaptureBody, request.body);

    const demo = await deps.db.one<{ id: string; platform: string }>(
      "SELECT id, platform FROM product_demo_projects WHERE id = $1 AND workspace_id = $2",
      [demoId, workspaceId],
    );
    if (!demo) {
      throw notFound("product demo project not found");
    }

    const persistedScenes = await deps.db.query<{
      id: string;
      order: number;
      url: string;
      action_description: string;
      caption: string;
      duration_seconds: number;
    }>(
      `SELECT id, "order", url, action_description, caption, duration_seconds
       FROM product_demo_scenes
       WHERE demo_project_id = $1
       ORDER BY "order" ASC`,
      [demoId],
    );
    if (persistedScenes.length === 0) {
      throw badRequest("product demo has no scenes; call /plan first");
    }

    const defaultViewport = input.viewport ?? viewportPresetForPlatform(demo.platform);
    const defaultMode = input.mode ?? "screenshot";
    const sceneOverrides = new Map((input.scenes ?? []).map((scene) => [scene.order, scene]));

    const captureScenes = persistedScenes.map((row) => {
      const override = sceneOverrides.get(row.order);
      return {
        order: row.order,
        url: override?.url ?? row.url,
        viewport: override?.viewport ?? defaultViewport,
        mode: override?.mode ?? defaultMode,
        durationMs: override?.duration_ms ?? row.duration_seconds * 1000,
        settleMs: override?.settle_ms ?? 800,
        actions: override?.actions ?? [],
      };
    });

    const result = await deps.videoWorker.capture({
      jobId: demoId,
      scenes: captureScenes,
    });

    return deps.db.tx(async (client) => {
      const updatedScenes: unknown[] = [];
      for (const captured of result.captures) {
        const scene = persistedScenes.find((s) => s.order === captured.order);
        if (!scene) {
          continue;
        }
        const media = await client.query(
          `
            INSERT INTO media_assets (
              workspace_id,
              user_id,
              source,
              media_kind,
              title,
              url,
              metadata_json,
              rights_json,
              status
            )
            VALUES ($1, $2, 'playwright', $3, $4, $5, $6::jsonb, '{}'::jsonb, 'approved')
            RETURNING *
          `,
          [
            workspaceId,
            request.authUser.id,
            captured.mode === "screen_recording" ? "video" : "image",
            `${scene.action_description || "Scene"} #${scene.order}`,
            captured.filePath,
            JSON.stringify({
              demo_project_id: demoId,
              scene_id: scene.id,
              captured_url: captured.url,
              width: captured.width,
              height: captured.height,
              capture_mode: captured.mode,
            }),
          ],
        );
        const mediaAssetId = (media.rows[0] as { id: string }).id;
        const updateColumn = captured.mode === "screen_recording" ? "screen_recording_asset_id" : "screenshot_asset_id";
        const sceneRow = await client.query(
          `UPDATE product_demo_scenes
           SET ${updateColumn} = $1
           WHERE id = $2
           RETURNING *`,
          [mediaAssetId, scene.id],
        );
        updatedScenes.push({ scene: sceneRow.rows[0], media_asset: media.rows[0], capture: captured });
      }
      const updatedDemo = await client.query(
        `UPDATE product_demo_projects SET status = 'captured', updated_at = now() WHERE id = $1 RETURNING *`,
        [demoId],
      );
      return { demo: updatedDemo.rows[0], scenes: updatedScenes };
    });
  });

  app.post("/v1/workspaces/:workspaceId/videos/product-demo/:demoId/render", async (request) => {
    const { workspaceId, demoId } = request.params as { workspaceId: string; demoId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    if (!deps.videoWorker) {
      throw badRequest("Video worker bridge is not configured");
    }
    const input = parseBody(productDemoRenderBody, request.body);
    await assertVideoRenderUsageAvailable(deps.db, workspaceId, 1);

    const demo = await deps.db.one<{ id: string; product_name: string; goal: string; project_id: string | null }>(
      "SELECT id, product_name, goal, project_id FROM product_demo_projects WHERE id = $1 AND workspace_id = $2",
      [demoId, workspaceId],
    );
    if (!demo) {
      throw notFound("product demo project not found");
    }

    const scenes = await deps.db.query<{
      id: string;
      order: number;
      caption: string;
      narration: string;
      action_description: string;
      duration_seconds: number;
      screenshot_url: string | null;
      screen_recording_url: string | null;
      screenshot_kind: string | null;
      screen_recording_kind: string | null;
    }>(
      `SELECT
         s.id,
         s."order",
         s.caption,
         s.narration,
         s.action_description,
         s.duration_seconds,
         shot.url AS screenshot_url,
         rec.url AS screen_recording_url,
         shot.media_kind AS screenshot_kind,
         rec.media_kind AS screen_recording_kind
       FROM product_demo_scenes s
       LEFT JOIN media_assets shot ON shot.id = s.screenshot_asset_id
       LEFT JOIN media_assets rec ON rec.id = s.screen_recording_asset_id
       WHERE s.demo_project_id = $1
       ORDER BY s."order" ASC`,
      [demoId],
    );
    if (scenes.length === 0) {
      throw badRequest("product demo has no scenes");
    }

    const jobId = randomUUID();

    const jobRow = await deps.db.one(
      `
        INSERT INTO video_jobs (
          id,
          user_id,
          workspace_id,
          project_id,
          template_key,
          status,
          render_provider,
          aspect_ratio
        )
        VALUES ($1, $2, $3, $4, 'product-demo', 'queued', 'ffmpeg', $5)
        RETURNING *
      `,
      [jobId, request.authUser.id, workspaceId, demo.project_id, input.aspect_ratio],
    );

    const assemblerScenes = scenes.map((scene) => ({
      order: scene.order,
      caption: scene.caption,
      narration: scene.narration,
      visualPrompt: scene.action_description,
      durationSeconds: scene.duration_seconds,
      ...(scene.screen_recording_url
        ? { videoPath: scene.screen_recording_url }
        : scene.screenshot_url
          ? { imagePath: scene.screenshot_url }
          : {}),
    }));

    const rendered = await deps.videoWorker.assemble({
      videoJobId: jobId,
      aspectRatio: input.aspect_ratio,
      title: demo.product_name,
      hook: demo.goal || `${demo.product_name} demo`,
      scenes: assemblerScenes,
    });

    return deps.db.tx(async (client) => {
      const asset = await client.query(
        `
          INSERT INTO video_assets (
            user_id,
            workspace_id,
            video_job_id,
            file_name,
            mime_type,
            storage_path,
            public_url,
            duration_seconds,
            width,
            height,
            status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'rendered')
          RETURNING *
        `,
        [
          request.authUser.id,
          workspaceId,
          jobId,
          rendered.fileName,
          rendered.mimeType,
          rendered.storagePath,
          rendered.publicUrl,
          rendered.durationSeconds,
          rendered.width,
          rendered.height,
        ],
      );
      const updatedJob = await client.query(
        `UPDATE video_jobs SET status = 'rendered', duration_seconds = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [rendered.durationSeconds, jobId],
      );
      const updatedDemo = await client.query(
        `UPDATE product_demo_projects SET status = 'rendered', updated_at = now() WHERE id = $1 RETURNING *`,
        [demoId],
      );
      await client.query(
        `INSERT INTO usage_events (workspace_id, user_id, event_type, quantity, metadata_json)
         VALUES ($1, $2, 'video_render', 1, $3::jsonb)`,
        [
          workspaceId,
          request.authUser.id,
          JSON.stringify({ video_job_id: jobId, demo_project_id: demoId, source: "product_demo" }),
        ],
      );
      return {
        demo: updatedDemo.rows[0],
        job: updatedJob.rows[0],
        asset: asset.rows[0],
        render: rendered,
      };
    });
  });

  // ============================================================
  // Storage — presign uploads for browser direct-to-R2/S3
  // ============================================================

  app.get("/v1/storage/status", async () => {
    return {
      enabled: deps.storage?.isEnabled() ?? false,
      kind: deps.storage?.isEnabled() ? "configured" : "disabled",
      help: deps.storage?.isEnabled()
        ? "POST /v1/workspaces/:id/uploads/presign to get a direct-to-bucket PUT URL."
        : "Set STORAGE_KIND=r2 (or s3), STORAGE_BUCKET, STORAGE_ACCESS_KEY_ID, STORAGE_SECRET_ACCESS_KEY (+ STORAGE_ENDPOINT for R2) to enable uploads.",
    };
  });

  app.post("/v1/workspaces/:workspaceId/uploads/presign", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    if (!deps.storage || !deps.storage.isEnabled()) {
      throw badRequest(
        "object storage is not configured. Set STORAGE_KIND=r2 (or s3) + STORAGE_BUCKET + STORAGE_ACCESS_KEY_ID + STORAGE_SECRET_ACCESS_KEY (+ STORAGE_ENDPOINT for R2).",
      );
    }
    const input = parseBody(uploadPresignBody, request.body);
    const folder = input.folder ?? `workspaces/${workspaceId}/uploads`;
    const presigned = deps.storage.presignUpload({
      fileName: input.file_name,
      contentType: input.content_type,
      folder,
      expiresSeconds: input.expires_seconds,
    });
    return {
      upload_url: presigned.uploadUrl,
      public_url: presigned.publicUrl,
      key: presigned.key,
      required_headers: presigned.requiredHeaders,
      expires_at: presigned.expiresAt,
      flow: [
        "Client PUTs the file binary to upload_url with the required_headers.",
        "On 200/201, client calls POST /v1/workspaces/:id/videos/people/upload with { url: public_url, file_name, mime_type, media_kind, is_real_user }.",
      ],
    };
  });

  // ============================================================
  // Phase 5 — people video upload + transcribe + edit + render
  // ============================================================

  app.post("/v1/workspaces/:workspaceId/videos/people/upload", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(peopleUploadBody, request.body);
    if (!input.is_real_user && !input.consent_attestation) {
      throw badRequest("non-real-user uploads require consent_attestation (FTC fake-testimonial rule)");
    }
    return deps.db.one(
      `
        INSERT INTO media_assets (
          workspace_id,
          user_id,
          source,
          media_kind,
          title,
          url,
          metadata_json,
          rights_json,
          status
        )
        VALUES ($1, $2, 'upload', $3, $4, $5, $6::jsonb, $7::jsonb, 'approved')
        RETURNING *
      `,
      [
        workspaceId,
        request.authUser.id,
        input.media_kind,
        input.file_name,
        input.url,
        JSON.stringify({
          mime_type: input.mime_type,
          size_bytes: input.size_bytes ?? null,
          duration_seconds: input.duration_seconds ?? null,
          is_real_user: input.is_real_user,
        }),
        JSON.stringify({
          is_real_user: input.is_real_user,
          consent_attestation: input.consent_attestation ?? null,
          consent_recorded_at: input.consent_attestation ? new Date().toISOString() : null,
        }),
      ],
    );
  });

  app.post("/v1/workspaces/:workspaceId/videos/people/transcribe", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(peopleTranscribeBody, request.body);

    const asset = await deps.db.one<{ id: string; url: string; media_kind: string }>(
      "SELECT id, url, media_kind FROM media_assets WHERE id = $1 AND workspace_id = $2",
      [input.media_asset_id, workspaceId],
    );
    if (!asset) {
      throw notFound("media asset not found");
    }

    if (!deps.whisper) {
      return placeholderTranscript(deps.db, workspaceId, asset.id);
    }

    const transcript = await deps.whisper.transcribe({
      audioUrl: asset.url,
      language: input.language,
      model: input.model,
    });

    return deps.db.tx(async (client) => {
      const track = await client.query(
        `
          INSERT INTO caption_tracks (video_job_id, format, content)
          VALUES (NULL, 'json', $1)
          RETURNING *
        `,
        [JSON.stringify({ text: transcript.text, language: transcript.language, model: transcript.model, media_asset_id: asset.id })],
      );
      const trackId = (track.rows[0] as { id: string }).id;
      for (const segment of transcript.segments) {
        await client.query(
          `
            INSERT INTO caption_segments (video_job_id, start_ms, end_ms, text, emphasis_words_json, style_json)
            VALUES (NULL, $1, $2, $3, '[]'::jsonb, '{}'::jsonb)
          `,
          [segment.startMs, segment.endMs, segment.text],
        );
      }
      return {
        track: track.rows[0],
        track_id: trackId,
        language: transcript.language,
        model: transcript.model,
        duration_seconds: transcript.durationSeconds,
        segments: transcript.segments,
        text: transcript.text,
      };
    });
  });

  app.post("/v1/workspaces/:workspaceId/videos/people/edit", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(peopleEditBody, request.body);

    const asset = await deps.db.one<{ id: string; metadata_json: { duration_seconds?: number } | null }>(
      "SELECT id, metadata_json FROM media_assets WHERE id = $1 AND workspace_id = $2",
      [input.media_asset_id, workspaceId],
    );
    if (!asset) {
      throw notFound("media asset not found");
    }

    const sourceDuration = Number(asset.metadata_json?.duration_seconds ?? input.target_duration_seconds);
    const targetDuration = Math.min(input.target_duration_seconds, Math.max(10, sourceDuration));

    return {
      media_asset_id: asset.id,
      target_duration_seconds: targetDuration,
      hook: input.hook || "Hook this with your strongest single sentence in 0–2s.",
      cta: input.cta || "End with a clear single CTA in the last 3 seconds.",
      suggested_scenes: defaultPeopleEditPlan(sourceDuration, targetDuration, input.hook, input.cta),
      compliance: {
        ftc_fake_testimonial_rule: true,
        require_real_user_audio: true,
        no_cloned_voice_without_consent: true,
      },
    };
  });

  app.post("/v1/workspaces/:workspaceId/videos/people/render", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    if (!deps.videoWorker) {
      throw badRequest("Video worker bridge is not configured");
    }
    const input = parseBody(peopleRenderBody, request.body);
    await assertVideoRenderUsageAvailable(deps.db, workspaceId, 1);

    const asset = await deps.db.one<{ id: string; url: string; rights_json: { is_real_user?: boolean } | null }>(
      "SELECT id, url, rights_json FROM media_assets WHERE id = $1 AND workspace_id = $2",
      [input.media_asset_id, workspaceId],
    );
    if (!asset) {
      throw notFound("media asset not found");
    }
    if (asset.rights_json && asset.rights_json.is_real_user === false) {
      throw badRequest("people-video render refused: media is flagged as not a real user. Use product-demo or broll flows.");
    }

    let captionsForRender: Array<{ startMs?: number; endMs?: number; text: string }> = [];
    if (input.caption_track_id) {
      const segments = await deps.db.query<{ start_ms: number; end_ms: number; text: string }>(
        "SELECT start_ms, end_ms, text FROM caption_segments WHERE video_job_id IS NULL ORDER BY start_ms ASC LIMIT 500",
      );
      captionsForRender = segments.map((segment) => ({
        startMs: segment.start_ms,
        endMs: segment.end_ms,
        text: segment.text,
      }));
    }

    const jobId = randomUUID();
    const jobRow = await deps.db.one(
      `
        INSERT INTO video_jobs (
          id,
          user_id,
          workspace_id,
          template_key,
          status,
          render_provider,
          aspect_ratio
        )
        VALUES ($1, $2, $3, 'people-video', 'queued', 'ffmpeg', $4)
        RETURNING *
      `,
      [jobId, request.authUser.id, workspaceId, input.aspect_ratio],
    );

    const assemblerScenes = input.scenes.map((scene) => ({
      order: scene.order,
      caption: scene.caption,
      narration: scene.narration,
      visualPrompt: "User-uploaded footage",
      durationSeconds: Math.max(1, scene.end_seconds - scene.start_seconds),
      videoUrl: asset.url,
    }));

    const rendered = await deps.videoWorker.assemble({
      videoJobId: jobId,
      aspectRatio: input.aspect_ratio,
      hook: input.hook || "People video",
      scenes: assemblerScenes,
      captions: captionsForRender,
    });

    return deps.db.tx(async (client) => {
      const videoAsset = await client.query(
        `
          INSERT INTO video_assets (
            user_id, workspace_id, video_job_id, file_name, mime_type, storage_path,
            public_url, duration_seconds, width, height, status
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'rendered')
          RETURNING *
        `,
        [
          request.authUser.id,
          workspaceId,
          jobId,
          rendered.fileName,
          rendered.mimeType,
          rendered.storagePath,
          rendered.publicUrl,
          rendered.durationSeconds,
          rendered.width,
          rendered.height,
        ],
      );
      const updatedJob = await client.query(
        `UPDATE video_jobs SET status = 'rendered', duration_seconds = $1, updated_at = now() WHERE id = $2 RETURNING *`,
        [rendered.durationSeconds, jobId],
      );
      await client.query(
        `INSERT INTO usage_events (workspace_id, user_id, event_type, quantity, metadata_json)
         VALUES ($1, $2, 'video_render', 1, $3::jsonb)`,
        [
          workspaceId,
          request.authUser.id,
          JSON.stringify({ video_job_id: jobId, media_asset_id: asset.id, source: "people_video" }),
        ],
      );
      return { job: updatedJob.rows[0], asset: videoAsset.rows[0], render: rendered };
    });
  });

  app.post("/v1/workspaces/:workspaceId/videos/captions/generate", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    const input = parseBody(captionsGenerateBody, request.body);

    let audioUrl = input.audio_url;
    let mediaAssetId: string | null = null;
    if (input.media_asset_id) {
      const asset = await deps.db.one<{ id: string; url: string }>(
        "SELECT id, url FROM media_assets WHERE id = $1 AND workspace_id = $2",
        [input.media_asset_id, workspaceId],
      );
      if (!asset) {
        throw notFound("media asset not found");
      }
      audioUrl = audioUrl ?? asset.url;
      mediaAssetId = asset.id;
    }
    if (!audioUrl) {
      throw badRequest("audio_url or media_asset_id is required");
    }
    if (!deps.whisper) {
      throw badRequest("whisper service is not configured. Set USE_WHISPER=true and WHISPER_URL.");
    }

    const transcript = await deps.whisper.transcribe({
      audioUrl,
      language: input.language,
      model: input.model,
    });

    return {
      language: transcript.language,
      model: transcript.model,
      duration_seconds: transcript.durationSeconds,
      text: transcript.text,
      segments: transcript.segments,
      media_asset_id: mediaAssetId,
    };
  });

  // ============================================================
  // Higgsfield-style motion broll
  // ============================================================

  app.get("/v1/videos/motion-presets", async () => {
    return {
      presets: listMotionPresets().map((preset) => ({
        key: preset.key,
        label: preset.label,
        prompt_suffix: preset.promptSuffix,
        default_duration_seconds: preset.defaultDurationSeconds,
        good_for: preset.goodFor,
        providers: Object.keys(preset.providerParams),
      })),
      providers: deps.videoProviders?.list() ?? [],
    };
  });

  app.post("/v1/workspaces/:workspaceId/videos/broll/generate", async (request) => {
    const { workspaceId } = request.params as { workspaceId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    if (!deps.videoProviders) {
      throw badRequest("video provider router is not configured");
    }
    const input = parseBody(brollGenerateBody, request.body);
    const preset = getMotionPreset(input.motion_preset);
    if (!preset) {
      throw badRequest(`unknown motion_preset: ${input.motion_preset}`);
    }
    await assertVideoRenderUsageAvailable(deps.db, workspaceId, 1);

    const adapter = deps.videoProviders.resolve(input.provider);
    if (adapter.key === "manual" && input.provider && input.provider !== "manual") {
      throw badRequest(
        `provider '${input.provider}' is not configured. Set its API key env var, or omit provider to use the first available.`,
      );
    }

    const jobId = randomUUID();
    const result = await adapter.generate({
      jobId,
      sourceImageUrl: input.source_image_url,
      prompt: input.prompt,
      negativePrompt: input.negative_prompt,
      preset,
      durationSeconds: input.duration_seconds ?? preset.defaultDurationSeconds,
      aspectRatio: input.aspect_ratio,
    });

    return deps.db.tx(async (client) => {
      const visualAsset = await client.query(
        `
          INSERT INTO visual_assets (
            workspace_id, user_id, type, media_kind, prompt, workflow_key,
            workflow_json, external_provider, external_job_id, status, output_url
          )
          VALUES ($1, $2, 'broll', 'video', $3, $4, $5::jsonb, $6, $7, $8, $9)
          RETURNING *
        `,
        [
          workspaceId,
          request.authUser.id,
          input.prompt,
          `motion-preset-${preset.key}`,
          JSON.stringify({
            preset: preset.key,
            provider_params: preset.providerParams[adapter.key] ?? {},
            aspect_ratio: input.aspect_ratio,
            duration_seconds: input.duration_seconds ?? preset.defaultDurationSeconds,
            source_image_url: input.source_image_url,
          }),
          adapter.key,
          result.externalJobId ?? null,
          result.status === "completed" ? "generated" : result.status === "failed" ? "failed" : "generating",
          result.videoUrl ?? null,
        ],
      );
      await client.query(
        `INSERT INTO usage_events (workspace_id, user_id, event_type, quantity, metadata_json)
         VALUES ($1, $2, 'video_render', 1, $3::jsonb)`,
        [
          workspaceId,
          request.authUser.id,
          JSON.stringify({ broll_job_id: jobId, provider: adapter.key, preset: preset.key }),
        ],
      );
      return {
        visual_asset: visualAsset.rows[0],
        provider: adapter.key,
        status: result.status,
        external_job_id: result.externalJobId ?? null,
        video_url: result.videoUrl ?? null,
        preset: { key: preset.key, label: preset.label },
        error: result.error,
      };
    });
  });

  app.post("/v1/workspaces/:workspaceId/videos/broll/:assetId/poll", async (request) => {
    const { workspaceId, assetId } = request.params as { workspaceId: string; assetId: string };
    await requireWorkspaceRole(deps.db, request.authUser, workspaceId, ["owner", "admin", "editor"]);
    if (!deps.videoProviders) {
      throw badRequest("video provider router is not configured");
    }
    const input = parseBody(brollPollBody, request.body);
    const adapter = deps.videoProviders.byKey(input.provider);
    if (!adapter || !adapter.poll) {
      throw badRequest(`provider does not support polling: ${input.provider}`);
    }

    const polled = await adapter.poll(assetId, input.external_job_id);
    if (polled.status !== "completed") {
      return { status: polled.status, video_url: polled.videoUrl ?? null };
    }

    const updated = await deps.db.one(
      `
        UPDATE visual_assets
        SET status = 'generated', output_url = $1, updated_at = now()
        WHERE id = $2 AND workspace_id = $3
        RETURNING *
      `,
      [polled.videoUrl ?? null, assetId, workspaceId],
    );
    return { status: "completed", video_url: polled.videoUrl ?? null, visual_asset: updated };
  });
}

function defaultPeopleEditPlan(
  sourceDuration: number,
  targetDuration: number,
  hook: string,
  cta: string,
): Array<{ order: number; start_seconds: number; end_seconds: number; caption: string }> {
  const ratio = sourceDuration > 0 ? Math.min(1, targetDuration / sourceDuration) : 1;
  const usable = Math.max(targetDuration, 8);
  const hookDuration = Math.min(3, usable * 0.15);
  const ctaDuration = Math.min(4, usable * 0.2);
  const bodyDuration = Math.max(usable - hookDuration - ctaDuration, 4);
  const bodyParts = 3;
  const bodySeg = bodyDuration / bodyParts;
  let cursor = 0;
  const plan: Array<{ order: number; start_seconds: number; end_seconds: number; caption: string }> = [];
  plan.push({
    order: 1,
    start_seconds: round2(cursor),
    end_seconds: round2(cursor + hookDuration * (1 / Math.max(ratio, 0.01))),
    caption: hook || "Strong hook in 0–2s",
  });
  cursor += hookDuration;
  for (let index = 0; index < bodyParts; index += 1) {
    plan.push({
      order: 2 + index,
      start_seconds: round2(cursor),
      end_seconds: round2(cursor + bodySeg),
      caption: ["What changed", "Why it matters", "Proof"][index],
    });
    cursor += bodySeg;
  }
  plan.push({
    order: 2 + bodyParts,
    start_seconds: round2(cursor),
    end_seconds: round2(cursor + ctaDuration),
    caption: cta || "Single clear CTA",
  });
  return plan;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function placeholderTranscript(db: Db, workspaceId: string, mediaAssetId: string): Promise<unknown> {
  return db.one(
    `INSERT INTO caption_tracks (video_job_id, format, content)
     VALUES (NULL, 'json', $1::jsonb)
     RETURNING *`,
    [JSON.stringify({ status: "pending", reason: "whisper service not configured", media_asset_id: mediaAssetId, workspace_id: workspaceId })],
  );
}

type ProductDemoPlannedScene = {
  order: number;
  url: string;
  action_description: string;
  narration: string;
  caption: string;
  duration_seconds: number;
  zoom_target_json: Record<string, unknown>;
};

function coerceMiniClawScene(scene: MiniClawProductDemoScene): ProductDemoPlannedScene {
  return {
    order: scene.order,
    url: scene.url,
    action_description: scene.action_description ?? "",
    narration: scene.narration ?? "",
    caption: scene.caption ?? "",
    duration_seconds: Math.max(2, Math.min(scene.duration_seconds ?? 5, 30)),
    zoom_target_json: scene.zoom_target_json ?? {},
  };
}

function defaultDemoScenes(demo: { product_name: string; product_url: string; goal: string }): ProductDemoPlannedScene[] {
  return [
    {
      order: 1,
      url: demo.product_url,
      action_description: `Open ${demo.product_name}`,
      narration: `Here is ${demo.product_name}.`,
      caption: `${demo.product_name}`,
      duration_seconds: 4,
      zoom_target_json: {},
    },
    {
      order: 2,
      url: demo.product_url,
      action_description: "Demonstrate the main feature",
      narration: demo.goal || `${demo.product_name} in action.`,
      caption: demo.goal || "Main feature",
      duration_seconds: 6,
      zoom_target_json: {},
    },
    {
      order: 3,
      url: demo.product_url,
      action_description: "Show the result",
      narration: "Here is the result.",
      caption: "Result",
      duration_seconds: 5,
      zoom_target_json: {},
    },
    {
      order: 4,
      url: demo.product_url,
      action_description: "Call to action",
      narration: `Try ${demo.product_name}.`,
      caption: `Try ${demo.product_name}`,
      duration_seconds: 4,
      zoom_target_json: {},
    },
  ];
}

function viewportPresetForPlatform(platform: string): "landscape_1920" | "linkedin_1080" | "vertical_1080" | "square_1080" {
  switch (platform) {
    case "linkedin":
      return "linkedin_1080";
    case "tiktok":
    case "instagram":
    case "youtube_shorts":
      return "vertical_1080";
    case "x":
      return "square_1080";
    default:
      return "vertical_1080";
  }
}

type VideoScriptSceneRow = {
  order?: number;
  scene_type?: string;
  narration?: string;
  caption?: string;
  visual_prompt?: string;
  duration_seconds?: number;
  media_url?: string;
  media_asset_url?: string;
};

type VideoScriptCaptionRow = {
  start_ms?: number;
  end_ms?: number;
  text?: string;
};

const VIDEO_FILE_EXTENSIONS = [".mp4", ".mov", ".m4v", ".webm", ".mkv"];

function mapVideoScriptScenesToAssembler(scenes: unknown[]): Array<{
  order?: number;
  caption?: string;
  narration?: string;
  visualPrompt?: string;
  durationSeconds?: number;
  videoUrl?: string;
  imageUrl?: string;
}> {
  if (!Array.isArray(scenes)) {
    return [];
  }
  return scenes
    .filter((scene): scene is VideoScriptSceneRow => typeof scene === "object" && scene !== null)
    .map((scene, index) => {
      const mediaUrl = scene.media_url ?? scene.media_asset_url ?? undefined;
      const sourceKey = mediaUrl ? (isVideoUrl(mediaUrl) ? "videoUrl" : "imageUrl") : null;
      return {
        order: scene.order ?? index + 1,
        caption: scene.caption ?? "",
        narration: scene.narration ?? "",
        visualPrompt: scene.visual_prompt ?? "",
        durationSeconds: scene.duration_seconds ?? undefined,
        ...(sourceKey === "videoUrl" ? { videoUrl: mediaUrl } : {}),
        ...(sourceKey === "imageUrl" ? { imageUrl: mediaUrl } : {}),
      };
    });
}

function mapVideoScriptCaptionsToAssembler(captions: unknown[]): Array<{ startMs?: number; endMs?: number; text: string }> {
  if (!Array.isArray(captions)) {
    return [];
  }
  return captions
    .filter((caption): caption is VideoScriptCaptionRow => typeof caption === "object" && caption !== null)
    .map((caption) => ({
      startMs: caption.start_ms,
      endMs: caption.end_ms,
      text: caption.text ?? "",
    }))
    .filter((caption) => caption.text.trim().length > 0);
}

function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return VIDEO_FILE_EXTENSIONS.some((ext) => lower.endsWith(ext) || lower.includes(`${ext}?`));
}

function buildCaptionText(captions: unknown[] | null | undefined): string {
  if (!Array.isArray(captions)) {
    return "";
  }

  return captions
    .map((caption) => {
      if (typeof caption === "string") {
        return caption;
      }
      if (typeof caption === "object" && caption !== null && "text" in caption) {
        const text = (caption as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function manualVideoUploadInstructions(platform: string): string[] {
  switch (platform) {
    case "linkedin":
      return [
        "Download or open the approved MP4.",
        "Create a LinkedIn post manually and upload the video.",
        "Paste the approved SocialOps post copy.",
        "Review platform preview, accessibility text, and visibility before publishing.",
      ];
    case "x":
      return [
        "Download or open the approved MP4.",
        "Create an X post manually and upload the video.",
        "Paste the approved post copy or thread text.",
        "Publish manually, then record metrics in SocialOps.",
      ];
    case "tiktok":
      return [
        "Download the approved vertical MP4 to your device.",
        "Upload it manually in TikTok.",
        "Paste the approved caption and review hashtags.",
        "Publish manually, then mark the SocialOps draft as manually published.",
      ];
    case "instagram":
      return [
        "Download the approved MP4 to your device.",
        "Upload it manually as a Reel or feed video in Instagram.",
        "Paste the approved caption.",
        "Publish manually and enter metrics back in SocialOps.",
      ];
    case "youtube_shorts":
      return [
        "Download the approved vertical MP4.",
        "Upload it manually in YouTube Studio as a Short.",
        "Paste the approved title/description.",
        "Publish manually and track views back in SocialOps.",
      ];
    default:
      return [
        "Download or open the approved MP4.",
        "Upload it manually on the target platform.",
        "Paste only approved SocialOps copy.",
        "Record publish status and metrics back in SocialOps.",
      ];
  }
}

function manualTextPublishInstructions(platform: string): string[] {
  switch (platform) {
    case "linkedin":
      return [
        "Open the intended LinkedIn account or page.",
        "Paste the approved SocialOps copy.",
        "Review links, media, visibility, and accessibility text.",
        "Publish manually, then mark the draft manually published in SocialOps.",
      ];
    case "x":
      return [
        "Open the intended X account.",
        "Paste the approved post or thread copy.",
        "Attach only approved media assets.",
        "Publish manually, then record metrics in SocialOps.",
      ];
    case "reddit":
      return [
        "Open the target subreddit with the intended account.",
        "Adapt only formatting if the subreddit requires it.",
        "Publish transparently without vote manipulation or spam automation.",
        "Record comments and performance back in SocialOps.",
      ];
    case "tiktok":
    case "instagram":
    case "youtube_shorts":
      return [
        "Use this copy as the approved caption or script.",
        "Upload the approved video asset manually on the target platform.",
        "Review platform preview before publishing.",
        "Record publish status and metrics back in SocialOps.",
      ];
    default:
      return [
        "Open the target platform manually.",
        "Paste only approved SocialOps copy.",
        "Attach only approved media assets.",
        "Record publish status and metrics back in SocialOps.",
      ];
  }
}

function defaultDraftTypeForChannel(channel: string, xThread: boolean): "post" | "thread" | "script" | "carousel" {
  if (channel === "x" && xThread) {
    return "thread";
  }
  if (channel === "tiktok" || channel === "youtube_shorts") {
    return "script";
  }
  if (channel === "instagram") {
    return "carousel";
  }
  return "post";
}

function extractPokeeSearchItems(search: Record<string, unknown>): PokeeSearchResultItem[] {
  const candidates = [
    search.results,
    search.organic,
    search.items,
    search.data,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate.filter((item): item is PokeeSearchResultItem => typeof item === "object" && item !== null);
    }
  }

  return [];
}

async function assertWorkspaceReferenceExists(
  db: Db,
  workspaceId: string,
  table: "agency_clients" | "projects" | "campaigns",
  id: string | null | undefined,
  message: string,
): Promise<void> {
  if (!id) {
    return;
  }
  const row = await db.one(`SELECT id FROM ${table} WHERE id = $1 AND workspace_id = $2`, [id, workspaceId]);
  if (!row) {
    throw notFound(message);
  }
}

async function assertMediaAssetsExist(db: Db, workspaceId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) {
    return;
  }
  const rows = await db.query<{ id: string }>(
    `
      SELECT id
      FROM media_assets
      WHERE workspace_id = $1
        AND id = ANY($2::uuid[])
    `,
    [workspaceId, ids],
  );
  if (rows.length !== new Set(ids).size) {
    throw notFound("one or more media assets were not found");
  }
}

function formatUgcDraftContent(
  brief: {
    title: string;
    product_or_offer: string;
    hooks_json: string[];
    talking_points_json: string[];
    do_not_say_json: string[];
    deliverables_json: unknown[];
  },
  channel: string,
): string {
  const hooks = brief.hooks_json.length > 0 ? brief.hooks_json : ["Show the real problem this solves."];
  const talkingPoints = brief.talking_points_json.length > 0 ? brief.talking_points_json : ["Explain the product or offer from real use."];
  const doNotSay = brief.do_not_say_json.length > 0 ? brief.do_not_say_json : ["Do not invent results, customers, or metrics."];

  return [
    `UGC script for ${channel.replace("_", " ")}`,
    "",
    `Brief: ${brief.title}`,
    `Product/offer: ${brief.product_or_offer || "Missing product or offer context"}`,
    "",
    "Hook options:",
    ...hooks.map((hook) => `- ${hook}`),
    "",
    "Talking points:",
    ...talkingPoints.map((point) => `- ${point}`),
    "",
    "Suggested structure:",
    "- Hook",
    "- Real problem or situation",
    "- Product/use-case demonstration",
    "- Specific takeaway",
    "- Soft CTA",
    "",
    "Do not say:",
    ...doNotSay.map((item) => `- ${item}`),
    "",
    `Deliverables: ${JSON.stringify(brief.deliverables_json)}`,
  ].join("\n");
}
