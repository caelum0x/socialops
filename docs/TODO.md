# SocialOps TODO

Companion to `docs/ARCHITECTURE.md`. Source: `PLAN.md`, `PLAN1.md`, `VENDOR.md`, `GAPS.md`.
Snapshot: 2026-05-26. Tests: 38/38 passing, type check clean, workspace check failing on lost `services/comfyui/README.md` (see Phase 0).

Legend: `⬜` not started · `🟡` partial · `✅` done · 🔴 blocker · 🟠 high · 🟡 medium · 🟢 low

---

## Phase 0 — Recover baseline (1 day, 🔴 blocker)

Mid-session, `services/comfyui|postiz|pokee-research/` and `VENDOR.md` vanished from disk. Until these come back, the workspace consistency check fails and several documented service-boundary READMEs are missing.

- [ ] **0.1** Confirm whether the files exist anywhere recoverable (`~/Library`, Time Machine, iCloud, other branches). If yes — restore.
- [ ] **0.2** If not recoverable: regenerate from spec.
  - `services/comfyui/README.md` — copy the boundary text from VENDOR.md §2 and PLAN.md §AI Service Boundaries.
  - `services/postiz/README.md` — AGPL boundary, reference-only.
  - `services/pokee-research/README.md` — Apache-2.0 service.
  - `VENDOR.md` — already in context this session; rewrite from the original content.
- [ ] **0.3** Add `infra/backups/snapshot.sh` — daily tar of repo root excluding `node_modules`, `ComfyUI/models`, `postiz-app/.git`, `PokeeResearchOSS/.git`. Output to `~/socialops-backups/YYYY-MM-DD.tar.gz`. Cron daily.
- [ ] **0.4** `pnpm run check:workspace` passes again.

Acceptance: workspace check green, VENDOR.md back at repo root, daily backup running.

---

## Phase 1 — Make video pipeline real (3–5 days, 🟠 high)

Without real Remotion templates and real FFmpeg post-processing, every "rendered" video today is a metadata stub.

### 1.1 Remotion templates (`apps/video-worker/src/remotion/`)
- [ ] **1.1.1** `CareerLessonVertical.tsx` — 9:16, 20–45s, hook title + 3 lesson cards + CTA. Composition + schema props.
- [ ] **1.1.2** `LinkedInProUpdate.tsx` — 4:5, 45–90s, title card → update body → reflection → question CTA.
- [ ] **1.1.3** `FounderWeeklyUpdate.tsx` — 16:9 + 4:5, 45–75s, shipped / broke / learned / next.
- [ ] **1.1.4** `ProductDemo.tsx` — 16:9 + 9:16, 30–90s, problem → action → result → CTA. Accepts `screen_recording_url` and `cursor_zoom_points`.
- [ ] **1.1.5** `ProjectBuildLog.tsx` — 9:16, 30–60s, name → built → hard part → result → next.
- [ ] **1.1.6** Register all 5 in `apps/video-worker/src/templates.ts` with stable `template_key`s matching the existing API contract.
- [ ] **1.1.7** Vitest: render each template in dry-run mode, assert composition props + duration.

### 1.2 FFmpeg post-processing (`apps/video-worker/src/ffmpeg.ts`)
- [ ] **1.2.1** Caption burn-in from `caption_segments` (style presets: Clean Pro, TikTok Bold, Startup Demo, Career Min, Dark Tech, White LinkedIn).
- [ ] **1.2.2** Per-platform resize (9:16, 16:9, 1:1, 4:5) with safe-area cropping for TikTok UI.
- [ ] **1.2.3** Trim / stitch helper for multi-scene jobs.
- [ ] **1.2.4** CTA end-card append (optional, from job payload).
- [ ] **1.2.5** Hook the post-processor into `/render` after Remotion finishes. Update `VideoAsset.duration_seconds`, `width`, `height` from the actual output.
- [ ] **1.2.6** Use LGPL-only FFmpeg build. Document in `packages/licensing/THIRD_PARTY.md`.

### 1.3 Wire the worker into the API
- [ ] **1.3.1** Confirm `/v1/workspaces/:id/videos/jobs/:id/render` actually invokes the new pipeline end-to-end.
- [ ] **1.3.2** Integration test using the existing mock VideoWorkerClient + a one-real-render Vitest behind `VIDEO_WORKER_REAL=1`.

**Risk:** Remotion 4.x ships with React 18; bundle size on Mac builds is ~150MB. **Mitigation:** lazy-load templates per composition; cache the bundler.

**Closes:** Build-order #25 (real), AC #18 (real).

---

## Phase 2 — OpenPost media bridge (2–3 days, 🟠 high)

Today the API has `/content-drafts/:id/openpost` and `/videos/assets/:id/send-to-openpost` but the per-resource bridge to OpenPost media is missing.

- [ ] **2.1** New package `packages/social-bridge/src/openpost.ts` — typed client over the existing OpenPost middleware token.
  - `uploadMedia({ workspaceId, mimeType, sourcePath, publicUrl }) → { openpost_media_id }`
  - `createPost({ workspaceId, accountIds, text, mediaIds, scheduledAt }) → { openpost_post_id, status }`
  - `schedulePost({ postId, scheduledAt, randomDelayMinutes }) → { status }`
- [ ] **2.2** New API routes (mirroring PLAN.md §AI Service Boundaries):
  - `POST /v1/workspaces/:id/social/openpost/upload-media`
  - `POST /v1/workspaces/:id/social/openpost/create-post`
  - `POST /v1/workspaces/:id/social/openpost/schedule-post`
- [ ] **2.3** `send-to-openpost` (already a route) now actually calls the bridge: upload `VideoAsset` → upload to OpenPost → attach to draft → optionally schedule. Updates `video_post_bridges` rows transactionally.
- [ ] **2.4** OpenPost fork: confirm `POST /api/v1/uploads` accepts `X-SocialOps-Internal-Token` for media; add migration if needed.
- [ ] **2.5** Tests: mock OpenPost client returns success/failure; assert `video_post_bridges.status` transitions; assert idempotency on retries.

**Risk:** OpenPost Go fork hasn't been touched in months; the upload endpoint may need a small patch. **Mitigation:** keep the bridge thin so retries are safe.

**Closes:** V1 #21, #23 (fully); build-order #21, #27.

---

## Phase 3 — PLAN1 local AI stack basics (4–6 days, 🟡 medium)

Three concrete wins from PLAN1.md that unlock real workflows without GPU.

### 3.1 Whisper captions (`services/whisper`)
- [ ] **3.1.1** Tiny Python service: FastAPI + `faster-whisper` (CTranslate2). Endpoint `POST /transcribe` accepts audio file; returns JSON timed captions.
- [ ] **3.1.2** Compose entry; CPU-only mode for Mac. Bench: 1min audio < 8s.
- [ ] **3.1.3** TS client in `packages/integrations/src/whisper.ts`.
- [ ] **3.1.4** API: `POST /v1/workspaces/:id/videos/captions/generate` — input `{ video_asset_id | media_asset_id, language? }` → writes `caption_tracks` + `caption_segments`.

### 3.2 OpenVoice / Piper voiceover (`services/voice`)
- [ ] **3.2.1** Python service exposing both OpenVoice V2 and Piper (Piper as fallback for fast TTS).
- [ ] **3.2.2** `POST /tts` body `{ text, voice_key, provider: "openvoice"|"piper" }` → MP3.
- [ ] **3.2.3** TS client in `packages/integrations/src/voice.ts`.
- [ ] **3.2.4** API: `POST /v1/workspaces/:id/videos/voiceover/generate` → writes `voiceover_assets`.
- [ ] **3.2.5** **Consent gate**: cloning a voice via OpenVoice requires `consent_artifact_id` (an uploaded signed consent file). Otherwise only Piper is allowed.

### 3.3 rembg cutouts (`services/rembg`)
- [ ] **3.3.1** Reuse the official MIT `rembg` container.
- [ ] **3.3.2** `POST /v1/workspaces/:id/visuals/cutout` — input image → transparent PNG; writes `visual_assets` row with `media_kind = image`, `workflow_key = rembg-cutout`.

**Risk:** Mac M-series Whisper accuracy varies. **Mitigation:** default to `large-v3-turbo`; allow `tiny` model toggle for cheap drafts.

**Closes:** V1 #20 first half; PLAN1 stack 3 → 6 done.

---

## Phase 4 — Product demo capture (3–4 days, 🟡 medium)

The most-promised SocialOps capability is "turn a SaaS URL into a TikTok demo". Today the table exists; the route doesn't.

- [ ] **4.1** New `apps/video-worker/src/playwright.ts` — controlled-viewport headless capture.
  - Viewport presets per PLAN.md §Video Engine: 1920×1080, 1080×1350, 1080×1920, 1080×1080.
  - Screenshot capture per scene `url + action_description`.
  - Optional `videoMode: 'screen_recording'` for full-page record.
- [ ] **4.2** API routes (PLAN.md §Video Engine):
  - `POST /v1/workspaces/:id/videos/product-demo/create`
  - `POST /v1/workspaces/:id/videos/product-demo/:id/plan` — AI splits goal into scene plan + ProductDemoScene rows.
  - `POST /v1/workspaces/:id/videos/product-demo/:id/capture` — runs Playwright, stores screenshots.
  - `POST /v1/workspaces/:id/videos/product-demo/:id/render` — feeds scenes + screenshots into Remotion `ProductDemo.tsx`.
- [ ] **4.3** Cursor + zoom overlay in Remotion using `zoom_target_json`.
- [ ] **4.4** Tests: mock Playwright `chromium.launch()`; assert ProductDemoScene rows match spec.
- [ ] **4.5** Refuse to render against any URL not on a per-workspace allowlist (anti-abuse).

**Risk:** Browser-bot policies on some SaaS. **Mitigation:** allowlist + clear UA `SocialOpsDemoBot/1.0`.

**Closes:** V1 #19, build-order #29; AC for product demo.

---

## Phase 5 — People-video upload + caption flow (3–4 days, 🟡 medium)

Mode 1 of PLAN.md §Video Engine — user uploads raw video/audio, system transcribes, edits, captions, renders.

- [ ] **5.1** Upload route: `POST /v1/workspaces/:id/videos/people/upload` — accepts multipart; stores in object storage; creates `media_assets` row.
- [ ] **5.2** Transcribe: `POST /v1/workspaces/:id/videos/people/transcribe` — calls `services/whisper`; creates `caption_tracks` + `caption_segments`.
- [ ] **5.3** Edit suggestion: `POST /v1/workspaces/:id/videos/people/edit` — LLM proposes cut points + scene boundaries from the transcript.
- [ ] **5.4** Render: `POST /v1/workspaces/:id/videos/people/render` — Remotion `PeopleVideo.tsx` (new) renders cuts + burned captions + optional title/b-roll.
- [ ] **5.5** Mode 3 (avatar) — `POST /v1/workspaces/:id/videos/people/avatar` — HeyGen adapter gated behind paid plan + explicit `is_consenting_user: true`. Refuses public figures.
- [ ] **5.6** **FTC gate**: people-video script generator refuses first-person testimony framing unless `ugc_brief.is_real_user = true`. Add `is_real_user` to ugc_briefs schema.

**Closes:** V1 #20 second half; PLAN1 Workflow #2 ready.

---

## Phase 6 — Shorts / captions / voiceover / b-roll API surface (2–3 days, 🟢 low)

Mechanical CRUD-and-orchestration, mostly. Tables and workers exist.

- [ ] **6.1** `POST /v1/workspaces/:id/videos/shorts/script` — Level-1 TikTok/Reels/Shorts script.
- [ ] **6.2** `POST /v1/workspaces/:id/videos/shorts/render` — chooses `CareerLessonVertical` or `ProjectBuildLog` template.
- [ ] **6.3** `POST /v1/workspaces/:id/videos/broll/plan` — writes `broll_plans` rows from a `video_job_id`.
- [ ] **6.4** `POST /v1/workspaces/:id/videos/broll/generate` — for each plan row with `asset_type=ai_image|ai_video`, enqueue `visual-worker`; for `screenshot`, enqueue Playwright.
- [ ] **6.5** `POST /v1/workspaces/:id/videos/jobs/:id/approve` and `/reject` — convenience routes; today only `video_assets/:id/approval` exists.
- [ ] **6.6** Tests for each.

**Closes:** the remaining PLAN.md §Video Engine routes that aren't admin-facing.

---

## Phase 7 — MiniClaw HTTP integration (4–5 days, 🟡 medium)

Today generation happens inside `apps/api` via `packages/prompts` templates. PLAN.md §AI Service Boundaries says MiniClaw owns generation and enforces a first-party skill allowlist.

- [ ] **7.1** `apps/claw/socialops/` — implement skills as actual modules (today only `socialops-generate-draft/SKILL.md` description exists):
  - `capture_note`, `generate_linkedin_post`, `generate_x_post`, `generate_x_thread`, `generate_tiktok_script`, `generate_carousel_copy`, `generate_application_answer`, `generate_pitch_deck`, `generate_outreach_draft`, `generate_visual_prompt`, `generate_video_script`, `summarize_week`, `create_content_calendar`, `suggest_replies`, `create_follow_up`, `update_crm_lead`.
- [ ] **7.2** MiniClaw HTTP server (Express or Fastify), endpoint `POST /skills/:skill_key` with allowlist enforcement.
- [ ] **7.3** TS client in `packages/integrations/src/miniclaw.ts`.
- [ ] **7.4** Feature-flag `USE_MINICLAW_GENERATION=1` to gradually shift generation routes off API-internal prompts.
- [ ] **7.5** Source-of-truth pull: MiniClaw skills receive `personal_profile`, `career_profile`, `project`, `capture_notes`, `approved_claims`, `forbidden_claims`, `tone_profile`, `content_history` per skill call.
- [ ] **7.6** ClawHub strictly disabled in production config.
- [ ] **7.7** Tests for each skill: real-source generation produces a draft; missing-source generation flags `missing_info`.

**Closes:** V1 #8; build-order #3 and #12.

---

## Phase 8 — Auth + token encryption + admin (4–5 days, 🟠 high)

Today auth is dev-headers and OAuth tokens aren't encrypted.

- [ ] **8.1** `packages/security/src/crypto.ts` — AES-GCM encrypt/decrypt with `SOCIALOPS_TOKEN_KEY` (32-byte hex). `encryptOauthToken`, `decryptOauthToken`.
- [ ] **8.2** Migrate `social_accounts.oauth_token` column → encrypted blob. Backfill rotate playbook.
- [ ] **8.3** Real auth:
  - Email/password with bcrypt.
  - Magic-link email login (Resend or SMTP via env).
  - HTTP-only session cookie + CSRF.
  - `POST /v1/auth/register`, `POST /v1/auth/login`, `POST /v1/auth/logout`, `POST /v1/auth/magic`.
- [ ] **8.4** Onboarding state machine — `POST /v1/onboarding/start|step|complete`.
- [ ] **8.5** Admin routes:
  - `GET /v1/admin/users`
  - `GET /v1/admin/workspaces`
  - `GET /v1/admin/billing`
  - `GET /v1/admin/usage`
  - `GET /v1/admin/generations`
  - `GET /v1/admin/errors`
  - `POST /v1/admin/billing/:id/grant-plan`
  - `POST /v1/admin/billing/:id/revoke-plan`
  - `POST /v1/admin/billing/:id/reset-usage`
  - `GET /v1/admin/audit-logs?type=&since=`
- [ ] **8.6** Admin role gate.

**Closes:** V1 #3, #4, #27, #28.

---

## Phase 9 — Multi-account orchestration (3–4 days, 🟡 medium)

The operator runs many handles across platforms. The schema supports this; the orchestration logic doesn't yet.

- [ ] **9.1** `packages/content-engine/src/distribution.ts` — given a `ContentDraft`, target identities, and target channels, compute per-account variants (no copy-paste cross-posting).
- [ ] **9.2** `POST /v1/workspaces/:id/content-drafts/:id/distribute` — generates platform-native variants, creates one draft per (identity, channel), groups under a `distribution_plan_id`.
- [ ] **9.3** `GET /v1/workspaces/:id/distribution-plans/:id` — shows status across all variants.
- [ ] **9.4** Per-account cadence rules (minimum N hours between posts, max M per day) enforced at schedule time.
- [ ] **9.5** Tests cover: 3 X accounts + 1 LinkedIn + 2 TikTok from a single capture note → 6 distinct drafts in approval queue.

**Closes:** multi-account product gap; supports operator's actual workflow.

---

## Phase 10 — Analytics aggregator + metric sync (3 days, 🟢 low)

- [ ] **10.1** `GET /v1/workspaces/:id/analytics` — rollup of `content_metrics` by platform / channel / identity / time window.
- [ ] **10.2** `GET /v1/workspaces/:id/analytics/top` — best-performing drafts (impressions × engagement-rate score).
- [ ] **10.3** Manual entry already done. Connected-account sync stubs for X (free tier — public counts) and LinkedIn (only via official API when available).
- [ ] **10.4** Feed metrics back into x-algorithm scoring loop (already accepts `metrics_json`; ensure write-back path).

**Closes:** V1 partial #26; #34 build-order.

---

## Phase 11 — Frontend decision (variable, 🟡 medium)

Decide by **2026-06-15** between Path A (operator-only) and Path B (Next.js shell).

- [ ] **11.1** Compare bundled video pipeline UI vs. operator command bar UX with the actual operator (user).
- [ ] **11.2** If Path A: extend `apps/web` with calendar view, approval queue, multi-account variant browser, deck preview.
- [ ] **11.3** If Path B: scaffold `apps/web-next` with App Router, Tailwind, shadcn/ui; migrate routes incrementally; keep `apps/web` running until parity.
- [ ] **11.4** Either way: implement multi-account dashboard cards.

---

## Phase 12 — External AI video providers (paid, gated, 2–3 days, 🟢 low)

- [ ] **12.1** Adapter interface in `packages/video/src/providers/types.ts`.
- [ ] **12.2** Adapters: `runway.ts`, `luma.ts`, `pika.ts` (via Fal.ai), `heygen.ts`, `creatomate.ts`, `manual.ts`.
- [ ] **12.3** Routes pick `render_provider` from job; refuse if plan disallows (`canUseExternalVideoProvider(plan)` helper).
- [ ] **12.4** Per-plan monthly cap in `usage.ts` already exists for video renders; add provider-specific caps.
- [ ] **12.5** Cost telemetry into `usage_events`.

---

## Phase 13 — Deploy / monitoring / backups (3–5 days, 🟡 medium)

- [ ] **13.1** Verify `infra/compose/socialops.production.example.yml` boots end-to-end on a fresh Mac.
- [ ] **13.2** Reverse proxy (Caddy or Traefik) with HTTPS; OpenPost served at `/social/*`.
- [ ] **13.3** Postgres + object storage (MinIO) services in compose.
- [ ] **13.4** Health endpoints for every service; one `/health/all` aggregator.
- [ ] **13.5** Backup cron from Phase 0; restore drill.
- [ ] **13.6** Sentry or Highlight for error tracking.
- [ ] **13.7** Per-service log streaming (Vector → Loki, or just JSON to disk).
- [ ] **13.8** Deploy doc in `infra/DEPLOY.md`.

---

## Critical-path ordering

```
Phase 0 (recover)
   │
   ├── Phase 1 (video pipeline real) ───┐
   │       │                             ├──> Phase 4 (product demo)
   │       │                             ├──> Phase 5 (people video)
   │       │                             └──> Phase 6 (shorts/etc)
   │       │
   │       └── Phase 2 (OpenPost bridge) ──> Phase 9 (multi-account)
   │
   ├── Phase 3 (PLAN1 stack) ───────────────> Phase 5 (people captions)
   │
   ├── Phase 7 (MiniClaw)
   │
   ├── Phase 8 (auth/admin) ──> Phase 12 (paid providers) ──> Phase 13 (deploy)
   │
   └── Phase 10 (analytics) ──> Phase 11 (frontend decision)
```

Phases 0, 1, 2, 3, 7, 8 are the must-haves for "the operator can actually use this every day across all their accounts." Phases 4, 5, 6 deliver the differentiated video product. Phases 9, 10, 11, 12, 13 are scale / polish / launch.

---

## Estimates

| Phase | Days | Owner-only? | Complexity |
| --- | ---: | --- | --- |
| 0 | 1 | yes | Low |
| 1 | 3–5 | yes | Medium |
| 2 | 2–3 | yes | Medium |
| 3 | 4–6 | yes | Medium-High (Python services) |
| 4 | 3–4 | yes | Medium |
| 5 | 3–4 | yes | Medium |
| 6 | 2–3 | yes | Low |
| 7 | 4–5 | yes | Medium-High |
| 8 | 4–5 | yes | Medium-High |
| 9 | 3–4 | yes | Medium |
| 10 | 3 | yes | Low |
| 11 | 5–20 | depends | High if Path B |
| 12 | 2–3 | yes | Low |
| 13 | 3–5 | yes | Medium |
| **Total** | **~42–70 days** | | |

Solo-operator realistic: **~10 weeks of focused work** to V1 production.

---

## Definition of Done (V1)

The 30 acceptance criteria in `PLAN.md §Production V1 Scope`, currently 18/30 done. Phases 1–8 close the remaining 12. Phases 9–13 are post-V1 polish.

---

## Operator decisions (locked 2026-05-26)

1. **Lost files** — operator deleted; they were empty. Phase 0 reduced to backup script only.
2. **Frontend** — Path A (operator-only). Extend `apps/web`. Defer Next.js shell.
3. **Hardware** — MacBook Air 24GB dev + Hetzner CPU server for prod. No GPU. Local AI stack = CPU-only (rembg, Whisper, Piper). Wan/LTX local skipped — route to external paid APIs in Phase 12 if needed.
4. **Whisper** — `small.en` default + `tiny.en` for drafts. RAM-light, CPU-friendly.
5. **Auth** — Clerk. Phase 8 simplifies: no own email/password, Clerk handles sessions + magic-link + RBAC.

Phase impact:
- Phase 0 reduced to backup script (skip 0.1, 0.2, keep 0.3, 0.4).
- Phase 3 — drop ComfyUI Wan2.2/LTX local install; CPU services only (Whisper, OpenVoice/Piper, rembg).
- Phase 8 — replace own auth + magic-link with Clerk middleware in apps/api; admin routes unchanged.
- Phase 11 — Path A confirmed; reduced to extending `apps/web` with calendar + approval queue + multi-account variant browser.
