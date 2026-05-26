CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  auth_provider TEXT NOT NULL DEFAULT 'password',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  role TEXT NOT NULL DEFAULT 'user',
  email_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('personal', 'career', 'startup', 'company', 'agency', 'creator', 'team')),
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS brand_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  website TEXT,
  industry TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  target_customers_json JSONB NOT NULL DEFAULT '[]',
  brand_voice_json JSONB NOT NULL DEFAULT '{}',
  offer_json JSONB NOT NULL DEFAULT '[]',
  proof_points_json JSONB NOT NULL DEFAULT '[]',
  forbidden_claims_json JSONB NOT NULL DEFAULT '[]',
  competitors_json JSONB NOT NULL DEFAULT '[]',
  platforms_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agency_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  company_name TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  website TEXT,
  contact_name TEXT NOT NULL DEFAULT '',
  contact_email TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')) DEFAULT 'active',
  brand_profile_json JSONB NOT NULL DEFAULT '{}',
  content_pillars_json JSONB NOT NULL DEFAULT '[]',
  approval_rules_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

CREATE TABLE IF NOT EXISTS personal_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  headline TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  location TEXT NOT NULL DEFAULT '',
  education_json JSONB NOT NULL DEFAULT '[]',
  experience_json JSONB NOT NULL DEFAULT '[]',
  skills_json JSONB NOT NULL DEFAULT '[]',
  goals_json JSONB NOT NULL DEFAULT '[]',
  platforms_json JSONB NOT NULL DEFAULT '[]',
  tone_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS career_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  "current_role" TEXT NOT NULL DEFAULT '',
  target_roles_json JSONB NOT NULL DEFAULT '[]',
  internship_status TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  skills_to_show_json JSONB NOT NULL DEFAULT '[]',
  achievements_json JSONB NOT NULL DEFAULT '[]',
  portfolio_links_json JSONB NOT NULL DEFAULT '[]',
  content_pillars_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('startup', 'portfolio', 'school', 'work', 'freelance', 'content', 'open_source', 'career', 'other')),
  description TEXT NOT NULL DEFAULT '',
  stage TEXT NOT NULL DEFAULT '',
  website TEXT,
  links_json JSONB NOT NULL DEFAULT '[]',
  goals_json JSONB NOT NULL DEFAULT '[]',
  progress_json JSONB NOT NULL DEFAULT '[]',
  metrics_json JSONB NOT NULL DEFAULT '{}',
  content_pillars_json JSONB NOT NULL DEFAULT '[]',
  approved_claims_json JSONB NOT NULL DEFAULT '[]',
  forbidden_claims_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agency_client_id UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')) DEFAULT 'draft',
  platforms_json JSONB NOT NULL DEFAULT '[]',
  start_date DATE,
  end_date DATE,
  content_pillars_json JSONB NOT NULL DEFAULT '[]',
  deliverables_json JSONB NOT NULL DEFAULT '[]',
  kpis_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS capture_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('daily_update', 'weekly_update', 'lesson', 'achievement', 'mistake', 'idea', 'link', 'screenshot', 'voice_note', 'work_log')),
  content TEXT NOT NULL,
  media_json JSONB NOT NULL DEFAULT '[]',
  tags_json JSONB NOT NULL DEFAULT '[]',
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_client_id UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  openpost_post_id TEXT,
  mode TEXT NOT NULL CHECK (mode IN ('career', 'student', 'internship', 'builder', 'founder', 'freelancer', 'creator', 'job_search', 'project', 'agency')),
  channel TEXT NOT NULL CHECK (channel IN ('linkedin', 'x', 'tiktok', 'instagram', 'reddit', 'youtube_shorts', 'newsletter', 'portfolio', 'email', 'dm', 'blog', 'threads', 'bluesky', 'mastodon', 'facebook')),
  type TEXT NOT NULL CHECK (type IN ('post', 'thread', 'script', 'carousel', 'update', 'reply', 'outreach', 'deck', 'application_answer')),
  title TEXT NOT NULL DEFAULT '',
  hook TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('idea', 'draft', 'needs_review', 'approved', 'scheduled', 'published', 'manually_published', 'rejected', 'failed', 'archived')),
  target_audience TEXT NOT NULL DEFAULT '',
  purpose TEXT NOT NULL DEFAULT '',
  generated_by_ai BOOLEAN NOT NULL DEFAULT true,
  reason_this_works TEXT NOT NULL DEFAULT '',
  suggested_visual TEXT NOT NULL DEFAULT '',
  scheduled_for TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  source_note_ids_json JSONB NOT NULL DEFAULT '[]',
  media_asset_ids_json JSONB NOT NULL DEFAULT '[]',
  claims_used_json JSONB NOT NULL DEFAULT '[]',
  missing_info_json JSONB NOT NULL DEFAULT '[]',
  risk_notes TEXT NOT NULL DEFAULT '',
  metrics_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agency_client_id UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('upload', 'comfyui', 'remotion', 'external', 'manual')),
  media_kind TEXT NOT NULL CHECK (media_kind IN ('image', 'video', 'audio', 'voice', 'text_visual', 'document')),
  title TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  rights_json JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'used', 'archived')) DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ugc_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agency_client_id UUID REFERENCES agency_clients(id) ON DELETE SET NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  product_or_offer TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  platforms_json JSONB NOT NULL DEFAULT '[]',
  hooks_json JSONB NOT NULL DEFAULT '[]',
  talking_points_json JSONB NOT NULL DEFAULT '[]',
  do_not_say_json JSONB NOT NULL DEFAULT '[]',
  deliverables_json JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('draft', 'needs_review', 'approved', 'in_production', 'completed', 'archived')) DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS approval_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,
  item_id UUID NOT NULL,
  requested_action TEXT NOT NULL CHECK (requested_action IN ('approve', 'publish', 'send', 'export')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewer_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS social_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  positioning TEXT NOT NULL DEFAULT '',
  voice_json JSONB NOT NULL DEFAULT '{}',
  content_pillars_json JSONB NOT NULL DEFAULT '[]',
  platform_focus_json JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'archived')) DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, slug)
);

CREATE TABLE IF NOT EXISTS social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  identity_id UUID REFERENCES social_identities(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  handle TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  account_type TEXT NOT NULL DEFAULT 'personal',
  audience TEXT NOT NULL DEFAULT '',
  content_pillars_json JSONB NOT NULL DEFAULT '[]',
  posting_rules_json JSONB NOT NULL DEFAULT '{}',
  oauth_status TEXT NOT NULL DEFAULT 'disconnected',
  publishing_status TEXT NOT NULL DEFAULT 'manual',
  capabilities_json JSONB NOT NULL DEFAULT '[]',
  connected_at TIMESTAMPTZ,
  disconnected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, platform, provider_account_id)
);

CREATE TABLE IF NOT EXISTS content_calendar_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_draft_id UUID NOT NULL REFERENCES content_drafts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  linkedin_url TEXT,
  x_url TEXT,
  company TEXT,
  role TEXT,
  segment TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('new', 'drafted', 'contacted', 'replied', 'interested', 'paid', 'not_interested', 'archived')),
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS outreach_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'linkedin', 'x', 'other')),
  subject TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'sent', 'replied', 'archived')),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS content_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  content_draft_id UUID NOT NULL REFERENCES content_drafts(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  impressions INTEGER,
  likes INTEGER,
  comments INTEGER,
  shares INTEGER,
  clicks INTEGER,
  replies INTEGER,
  profile_visits INTEGER,
  leads INTEGER,
  entered_manually BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS visual_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  content_draft_id UUID REFERENCES content_drafts(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  media_kind TEXT NOT NULL DEFAULT 'image' CHECK (media_kind IN ('image', 'video', 'audio', 'voice', 'text_visual')),
  prompt TEXT NOT NULL,
  workflow_key TEXT NOT NULL DEFAULT '',
  workflow_json JSONB,
  external_provider TEXT,
  external_job_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'queued', 'generating', 'generated', 'approved', 'rejected', 'used', 'failed')),
  output_url TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('product_demo', 'tiktok', 'linkedin', 'avatar', 'carousel_video', 'pitch', 'update', 'explainer')),
  aspect_ratio TEXT NOT NULL CHECK (aspect_ratio IN ('9:16', '16:9', '1:1', '4:5')),
  duration_target_seconds INTEGER NOT NULL,
  renderer TEXT NOT NULL CHECK (renderer IN ('remotion', 'creatomate', 'external')),
  template_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  content_draft_id UUID REFERENCES content_drafts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('linkedin', 'x', 'tiktok', 'instagram', 'youtube_shorts', 'website')),
  mode TEXT NOT NULL CHECK (mode IN ('career', 'student', 'founder', 'creator', 'project', 'product_demo')),
  hook TEXT NOT NULL DEFAULT '',
  script TEXT NOT NULL DEFAULT '',
  scenes_json JSONB NOT NULL DEFAULT '[]',
  captions_json JSONB NOT NULL DEFAULT '[]',
  shot_list_json JSONB NOT NULL DEFAULT '[]',
  voiceover_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'approved', 'rejected')) DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  content_draft_id UUID REFERENCES content_drafts(id) ON DELETE SET NULL,
  video_script_id UUID REFERENCES video_scripts(id) ON DELETE SET NULL,
  template_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'planning', 'generating_assets', 'rendering', 'rendered', 'failed', 'approved', 'attached')) DEFAULT 'queued',
  render_provider TEXT NOT NULL CHECK (render_provider IN ('remotion', 'comfyui', 'runway', 'luma', 'heygen', 'creatomate', 'manual')) DEFAULT 'remotion',
  aspect_ratio TEXT NOT NULL CHECK (aspect_ratio IN ('9:16', '16:9', '1:1', '4:5')),
  duration_seconds INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS video_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_job_id UUID NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  scene_type TEXT NOT NULL CHECK (scene_type IN ('text', 'screenshot', 'screen_recording', 'ai_image', 'ai_video', 'avatar', 'b_roll', 'uploaded_media')),
  narration TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  visual_prompt TEXT,
  media_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 5,
  metadata_json JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS video_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_job_id UUID REFERENCES video_jobs(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'video/mp4',
  storage_path TEXT NOT NULL DEFAULT '',
  public_url TEXT,
  duration_seconds INTEGER,
  width INTEGER,
  height INTEGER,
  status TEXT NOT NULL CHECK (status IN ('rendered', 'approved', 'rejected', 'used')) DEFAULT 'rendered',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voiceover_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  video_job_id UUID NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  voice_key TEXT NOT NULL DEFAULT '',
  text TEXT NOT NULL,
  audio_url TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER,
  transcript_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS caption_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_job_id UUID NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
  format TEXT NOT NULL CHECK (format IN ('srt', 'vtt', 'json')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS caption_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_job_id UUID NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  text TEXT NOT NULL,
  emphasis_words_json JSONB NOT NULL DEFAULT '[]',
  style_json JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS product_demo_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_url TEXT NOT NULL DEFAULT '',
  goal TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  platform TEXT NOT NULL DEFAULT 'linkedin',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS product_demo_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demo_project_id UUID NOT NULL REFERENCES product_demo_projects(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  action_description TEXT NOT NULL DEFAULT '',
  narration TEXT NOT NULL DEFAULT '',
  caption TEXT NOT NULL DEFAULT '',
  screenshot_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  screen_recording_asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 5,
  zoom_target_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broll_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_job_id UUID NOT NULL REFERENCES video_jobs(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES video_scenes(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('screenshot', 'ai_image', 'ai_video', 'uploaded', 'diagram', 'stock_like')),
  prompt TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  asset_id UUID REFERENCES media_assets(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS video_post_bridges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_asset_id UUID NOT NULL REFERENCES video_assets(id) ON DELETE CASCADE,
  content_draft_id UUID NOT NULL REFERENCES content_drafts(id) ON DELETE CASCADE,
  openpost_media_id TEXT,
  openpost_post_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('not_uploaded', 'uploaded', 'attached', 'scheduled', 'failed')) DEFAULT 'not_uploaded',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS decks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  slides_json JSONB NOT NULL DEFAULT '[]',
  markdown TEXT NOT NULL DEFAULT '',
  renderer TEXT NOT NULL CHECK (renderer IN ('marp', 'slidev')),
  status TEXT NOT NULL DEFAULT 'draft',
  export_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('internship', 'job', 'accelerator', 'funding', 'grant', 'school', 'payment_provider', 'other')),
  deadline TIMESTAMPTZ,
  url TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS application_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  missing_info_json JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS research_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  source_note_id UUID REFERENCES capture_notes(id) ON DELETE SET NULL,
  topic TEXT NOT NULL,
  question TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  citations_json JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL CHECK (status IN ('draft', 'needs_review', 'approved', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_customer_id TEXT,
  manual_payment_notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  ai_drafts_per_month INTEGER NOT NULL,
  visual_generations_per_month INTEGER NOT NULL,
  video_renders_per_month INTEGER NOT NULL,
  deck_exports_per_month INTEGER NOT NULL,
  scheduled_posts_per_month INTEGER NOT NULL,
  connected_accounts INTEGER NOT NULL,
  granted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_projects_workspace ON projects(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agency_clients_workspace ON agency_clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace ON campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_capture_notes_workspace_project ON capture_notes(workspace_id, project_id);
CREATE INDEX IF NOT EXISTS idx_content_drafts_workspace_status ON content_drafts(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_content_drafts_workspace_mode ON content_drafts(workspace_id, mode);
CREATE INDEX IF NOT EXISTS idx_approval_items_workspace_status ON approval_items(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_social_identities_workspace_status ON social_identities(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_social_accounts_workspace_platform ON social_accounts(workspace_id, platform);
CREATE INDEX IF NOT EXISTS idx_content_metrics_draft ON content_metrics(content_draft_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_workspace ON media_assets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ugc_briefs_workspace ON ugc_briefs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_video_scripts_workspace ON video_scripts(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_jobs_workspace_status ON video_jobs(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_video_assets_workspace ON video_assets(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_demo_projects_workspace ON product_demo_projects(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_created ON audit_logs(workspace_id, created_at DESC);

ALTER TABLE content_drafts DROP CONSTRAINT IF EXISTS content_drafts_channel_check;
ALTER TABLE content_drafts
  ADD CONSTRAINT content_drafts_channel_check
  CHECK (channel IN ('linkedin', 'x', 'tiktok', 'instagram', 'reddit', 'youtube_shorts', 'newsletter', 'portfolio', 'email', 'dm', 'blog', 'threads', 'bluesky', 'mastodon', 'facebook'));

ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS identity_id UUID REFERENCES social_identities(id) ON DELETE SET NULL;
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS handle TEXT NOT NULL DEFAULT '';
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'personal';
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT '';
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS content_pillars_json JSONB NOT NULL DEFAULT '[]';
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS posting_rules_json JSONB NOT NULL DEFAULT '{}';
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS publishing_status TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE social_accounts ADD COLUMN IF NOT EXISTS capabilities_json JSONB NOT NULL DEFAULT '[]';
