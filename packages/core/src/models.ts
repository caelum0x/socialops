export const contentModes = [
  "career",
  "student",
  "internship",
  "builder",
  "founder",
  "freelancer",
  "creator",
  "job_search",
  "project",
  "agency",
] as const;

export const contentChannels = [
  "linkedin",
  "x",
  "tiktok",
  "instagram",
  "reddit",
  "youtube_shorts",
  "newsletter",
  "portfolio",
  "email",
  "dm",
  "blog",
  "threads",
  "bluesky",
  "mastodon",
  "facebook",
] as const;

export const contentStatuses = [
  "idea",
  "draft",
  "needs_review",
  "approved",
  "scheduled",
  "published",
  "manually_published",
  "rejected",
  "failed",
  "archived",
] as const;

export type ContentMode = (typeof contentModes)[number];
export type ContentChannel = (typeof contentChannels)[number];
export type ContentStatus = (typeof contentStatuses)[number];

export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer";
export type WorkspaceType = "personal" | "career" | "startup" | "company" | "agency" | "creator" | "team";
export type ProjectType =
  | "startup"
  | "portfolio"
  | "school"
  | "work"
  | "freelance"
  | "content"
  | "open_source"
  | "career"
  | "other";

export type CaptureNoteType =
  | "daily_update"
  | "weekly_update"
  | "lesson"
  | "achievement"
  | "mistake"
  | "idea"
  | "link"
  | "screenshot"
  | "voice_note"
  | "work_log";

export const videoTemplateTypes = [
  "product_demo",
  "tiktok",
  "linkedin",
  "avatar",
  "carousel_video",
  "pitch",
  "update",
  "explainer",
] as const;

export const videoAspectRatios = ["9:16", "16:9", "1:1", "4:5"] as const;
export const videoRenderProviders = ["remotion", "comfyui", "runway", "luma", "heygen", "creatomate", "manual"] as const;
export const videoJobStatuses = ["queued", "planning", "generating_assets", "rendering", "rendered", "failed", "approved", "attached"] as const;
export const videoScriptStatuses = ["draft", "approved", "rejected"] as const;

export type VideoTemplateType = (typeof videoTemplateTypes)[number];
export type VideoAspectRatio = (typeof videoAspectRatios)[number];
export type VideoRenderProvider = (typeof videoRenderProviders)[number];
export type VideoJobStatus = (typeof videoJobStatuses)[number];
export type VideoScriptStatus = (typeof videoScriptStatuses)[number];

export interface Workspace {
  id: string;
  owner_user_id: string;
  name: string;
  type: WorkspaceType;
  plan: "free" | "student" | "pro" | "founder_freelancer" | "studio";
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  created_at: string;
}

export interface PersonalProfile {
  id: string;
  user_id: string;
  name: string;
  headline: string;
  bio: string;
  location: string;
  education_json: unknown[];
  experience_json: unknown[];
  skills_json: string[];
  goals_json: string[];
  platforms_json: ContentChannel[];
  tone_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CareerProfile {
  id: string;
  user_id: string;
  current_role: string;
  target_roles_json: string[];
  internship_status: string;
  industry: string;
  skills_to_show_json: string[];
  achievements_json: string[];
  portfolio_links_json: string[];
  content_pillars_json: string[];
  created_at: string;
  updated_at: string;
}

export interface BrandProfile {
  id: string;
  workspace_id: string;
  name: string;
  company_name: string;
  website?: string | null;
  industry: string;
  description: string;
  target_customers_json: string[];
  brand_voice_json: Record<string, unknown>;
  offer_json: unknown[];
  proof_points_json: string[];
  forbidden_claims_json: string[];
  competitors_json: string[];
  platforms_json: ContentChannel[];
  created_at: string;
  updated_at: string;
}

export interface AgencyClient {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  company_name: string;
  industry: string;
  website?: string | null;
  contact_name: string;
  contact_email?: string | null;
  status: "active" | "paused" | "archived";
  brand_profile_json: Record<string, unknown>;
  content_pillars_json: string[];
  approval_rules_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Campaign {
  id: string;
  workspace_id: string;
  agency_client_id?: string | null;
  project_id?: string | null;
  name: string;
  objective: string;
  status: "draft" | "active" | "paused" | "completed" | "archived";
  platforms_json: ContentChannel[];
  start_date?: string | null;
  end_date?: string | null;
  content_pillars_json: string[];
  deliverables_json: unknown[];
  kpis_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MediaAsset {
  id: string;
  workspace_id: string;
  user_id: string;
  agency_client_id?: string | null;
  project_id?: string | null;
  campaign_id?: string | null;
  source: "upload" | "comfyui" | "remotion" | "external" | "manual";
  media_kind: "image" | "video" | "audio" | "voice" | "text_visual" | "document";
  title: string;
  url: string;
  thumbnail_url?: string | null;
  metadata_json: Record<string, unknown>;
  rights_json: Record<string, unknown>;
  status: "draft" | "approved" | "used" | "archived";
  created_at: string;
  updated_at: string;
}

export interface UgcBrief {
  id: string;
  workspace_id: string;
  agency_client_id?: string | null;
  project_id?: string | null;
  campaign_id?: string | null;
  title: string;
  product_or_offer: string;
  target_audience: string;
  platforms_json: ContentChannel[];
  hooks_json: string[];
  talking_points_json: string[];
  do_not_say_json: string[];
  deliverables_json: unknown[];
  status: "draft" | "needs_review" | "approved" | "in_production" | "completed" | "archived";
  created_at: string;
  updated_at: string;
}

export interface SocialIdentity {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  role: string;
  audience: string;
  positioning: string;
  voice_json: Record<string, unknown>;
  content_pillars_json: string[];
  platform_focus_json: ContentChannel[];
  status: "active" | "paused" | "archived";
  created_at: string;
  updated_at: string;
}

export interface SocialAccount {
  id: string;
  workspace_id: string;
  identity_id?: string | null;
  platform: ContentChannel;
  provider_account_id: string;
  handle: string;
  display_name: string;
  account_type: "personal" | "page" | "brand" | "community" | "client" | string;
  audience: string;
  content_pillars_json: string[];
  posting_rules_json: Record<string, unknown>;
  oauth_status: "connected" | "disconnected" | "expired" | "error" | string;
  publishing_status: "manual" | "openpost" | "postiz" | "native_api" | "disabled" | string;
  capabilities_json: string[];
  connected_at?: string | null;
  disconnected_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  type: ProjectType;
  description: string;
  stage: string;
  website?: string | null;
  links_json: string[];
  goals_json: string[];
  progress_json: unknown[];
  metrics_json: Record<string, unknown>;
  content_pillars_json: string[];
  approved_claims_json: string[];
  forbidden_claims_json: string[];
  created_at: string;
  updated_at: string;
}

export interface CaptureNote {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  agency_client_id?: string | null;
  campaign_id?: string | null;
  user_id: string;
  type: CaptureNoteType;
  content: string;
  media_json?: unknown[] | null;
  tags_json: string[];
  processed_at?: string | null;
  created_at: string;
}

export interface ContentDraft {
  id: string;
  workspace_id: string;
  project_id?: string | null;
  user_id: string;
  mode: ContentMode;
  channel: ContentChannel;
  type: "post" | "thread" | "script" | "carousel" | "update" | "reply" | "outreach" | "deck" | "application_answer";
  title: string;
  hook: string;
  content: string;
  status: ContentStatus;
  target_audience: string;
  purpose: string;
  generated_by_ai: boolean;
  reason_this_works: string;
  suggested_visual: string;
  risk_notes: string;
  scheduled_for?: string | null;
  published_at?: string | null;
  source_note_ids_json: string[];
  media_asset_ids_json: string[];
  claims_used_json: string[];
  missing_info_json: string[];
  metrics_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApprovalItem {
  id: string;
  workspace_id: string;
  item_type: "content_draft" | "visual_asset" | "video_asset" | "deck" | "outreach_message";
  item_id: string;
  requested_action: "approve" | "publish" | "send" | "export";
  status: "pending" | "approved" | "rejected";
  reviewer_user_id?: string | null;
  reviewer_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoTemplate {
  id: string;
  key: string;
  name: string;
  type: VideoTemplateType;
  aspect_ratio: VideoAspectRatio;
  duration_target_seconds: number;
  renderer: "remotion" | "creatomate" | "external";
  template_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface VideoScript {
  id: string;
  user_id: string;
  workspace_id: string;
  project_id?: string | null;
  content_draft_id?: string | null;
  title: string;
  platform: "linkedin" | "x" | "tiktok" | "instagram" | "youtube_shorts" | "website";
  mode: "career" | "student" | "founder" | "creator" | "project" | "product_demo";
  hook: string;
  script: string;
  scenes_json: unknown[];
  captions_json: unknown[];
  shot_list_json: unknown[];
  voiceover_text: string;
  status: VideoScriptStatus;
  created_at: string;
  updated_at: string;
}

export interface VideoJob {
  id: string;
  user_id: string;
  workspace_id: string;
  project_id?: string | null;
  content_draft_id?: string | null;
  video_script_id?: string | null;
  template_key: string;
  status: VideoJobStatus;
  render_provider: VideoRenderProvider;
  aspect_ratio: VideoAspectRatio;
  duration_seconds?: number | null;
  error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface VideoScene {
  id: string;
  video_job_id: string;
  order: number;
  scene_type: "text" | "screenshot" | "screen_recording" | "ai_image" | "ai_video" | "avatar" | "b_roll" | "uploaded_media";
  narration: string;
  caption: string;
  visual_prompt?: string | null;
  media_asset_id?: string | null;
  duration_seconds: number;
  metadata_json: Record<string, unknown>;
}

export interface VideoAsset {
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
  status: "rendered" | "approved" | "rejected" | "used";
  created_at: string;
}

export interface VideoExportPackage {
  asset: Pick<
    VideoAsset,
    "id" | "file_name" | "mime_type" | "storage_path" | "public_url" | "duration_seconds" | "width" | "height" | "status"
  >;
  content_draft: Pick<
    ContentDraft,
    "id" | "title" | "hook" | "content" | "channel" | "type" | "status" | "target_audience" | "purpose"
  > | null;
  post_copy: string;
  caption_text: string;
  manual_upload: {
    platform: string;
    required: boolean;
    ready: boolean;
    blocked_by: string[];
    instructions: string[];
    checklist: string[];
  };
  compliance: {
    human_approval_required: true;
    no_auto_posting: true;
    no_browser_automation: true;
    no_auto_dm: true;
  };
}

export interface Deck {
  id: string;
  user_id: string;
  workspace_id: string;
  project_id?: string | null;
  type: string;
  title: string;
  slides_json: unknown[];
  markdown: string;
  renderer: "marp" | "slidev";
  status: "draft" | "needs_review" | "approved" | "rejected" | "rendered" | "failed" | "archived";
  export_url?: string | null;
  created_at: string;
  updated_at: string;
}
