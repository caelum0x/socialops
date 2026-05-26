# SocialOps Gap Report

Snapshot date: 2026-05-26 (updated after first work pass)
Audit basis: `PLAN.md`, `PLAN1.md`, `VENDOR.md` vs. current `socialops/` working tree.

Legend: `done` = implemented and wired, `partial` = present but incomplete / not end-to-end, `missing` = no evidence in code.

## Changelog
- **2026-05-27 batch 6 (a + b + c: storage, web upload, Hetzner deploy)**: **(a) R2/S3 storage**: pure-Node `apps/api/src/storage.ts` with SigV4 presigning (no AWS SDK dep) — supports R2 (`STORAGE_KIND=r2` + `STORAGE_ENDPOINT`), S3, and disabled. New routes `GET /v1/storage/status`, `POST /v1/workspaces/:id/uploads/presign` returning presigned PUT URL + final public URL + required headers + step-by-step flow. **(b) Web UI drag-and-drop**: `apps/web` now has a "Drop a clip" card with drag-drop + click-pick + FTC real-user checkbox + recent-uploads list. Full browser → presign → direct R2 PUT → register-as-media-asset flow in ~150 LOC. Styles in `apps/web/src/styles.css`. **(c) Hetzner deploy**: `infra/DEPLOY_HETZNER.md` with CCX23 sizing (~$16/mo total), Cloudflare R2 setup walkthrough, env template, Caddy reverse-proxy snippet, manual-upload smoke test. Compose file extended with Whisper service + scratch volume + storage env-var pass-through + all video provider env vars. +5 tests = **51/51 passing**. Types clean. Workspace check 38/0.
- **2026-05-27 batch 5 (Free-tier video providers)**: Added 5 new adapters to the video-providers router: `kling_ai` (60/day free on web, paid API), `hailuo_minimax` (free tier on web), `replicate` (cheapest API, hosts Wan2.2/Hunyuan/LTX/Mochi/CogVideoX), `fal_ai` (LTX-Video by default, hosts open models), `huggingface_space` (truly free, gradio-style call to a hosted Space). Adapter preference reordered so cheap-first picks Kling → Hailuo → Replicate → fal → HF before paid premium (Higgsfield/Runway/Luma/Pika). New env vars in `apps/api/src/config.ts`: `KLING_AI_ACCESS_KEY` + `KLING_AI_SECRET_KEY`, `HAILUO_API_KEY`, `REPLICATE_API_TOKEN` + `REPLICATE_MODEL_DEFAULT`, `HUGGINGFACE_TOKEN` + `HUGGINGFACE_SPACE`, `FAL_API_KEY`. Honest doc at `docs/FREE_VIDEO.md` covering: why local on Mac doesn't work, why Luma blocks Turkey/several regions, the truly-zero-cost manual-upload workflow, ranked adapter table, deep dive on each free tier. 46/46 tests still passing.
- **2026-05-26 batch 4 (Phase 3+5+7+8 + Higgsfield-style broll)**: One sweep. **Phase 8**: `IdentityProvider` interface (`apps/api/src/identity.ts`) with `DevHeader` + `Clerk` implementations; auto-selects based on `CLERK_SECRET_KEY`. **Phase 3**: `services/whisper/` (FastAPI + faster-whisper, CPU-only, `small.en` default), TS `WhisperClient`, new `POST /v1/workspaces/:id/videos/captions/generate` route. **Phase 5**: 4 people-video routes (`upload`, `transcribe`, `edit`, `render`) — upload writes a `media_assets` row with FTC consent flags; non-real-user uploads without `consent_attestation` get 400; render path refuses to render flagged-not-real media. **Phase 7**: `MiniClawClient` with 18-skill allowlist; product-demo `/plan` now uses MiniClaw when configured (`USE_MINICLAW_GENERATION=true`), gracefully falls back to default planner on failure. New SKILL.md at `apps/claw/skills/socialops-plan-product-demo-scenes/`. **Higgsfield-style motion broll**: 12 motion presets (`crash_zoom`, `dolly_in`, `slow_orbit`, `robo_arm_reveal`, `whip_pan`, `vortex_pull`, `parallax_pan`, `fpv_dive`, `macro_glide`, `slow_push_in`, `dolly_out`, `static_locked`) in `apps/api/src/motion-presets.ts`. Provider router (`apps/api/src/video-providers.ts`) with `higgsfield`, `runway_gen3`, `luma_dream`, `pika`, `comfyui_wan_i2v`, `manual` adapters. New routes: `GET /v1/videos/motion-presets`, `POST /v1/workspaces/:id/videos/broll/generate`, `POST /v1/workspaces/:id/videos/broll/:assetId/poll`. **+7 tests = 46/46 passing**, types clean, workspace check 38/0.
- **2026-05-26 batch 3 (Phase 4 — Playwright product demo)**: Added Playwright capture module + `/capture` endpoint on the video worker (dynamic import so optional peer dep doesn't block startup or tests). 4 viewport presets (landscape_1920, linkedin_1080, vertical_1080, square_1080). Per-scene action list (wait_ms / wait_for / click / type / scroll). 4 new API routes: `POST /v1/workspaces/:id/videos/product-demo/{create | :id/plan | :id/capture | :id/render}`. Captured screenshots auto-persist as `media_assets` (source='playwright') and update `product_demo_scenes.screenshot_asset_id` (or `screen_recording_asset_id`). Render path emits a real `video_jobs` + `video_assets` row through the existing FFmpeg assembler with image paths → Ken-Burns clips. 1 new test (39/39 passing). Dumb default scene planner this batch (intro / feature / result / CTA); MiniClaw replaces it in Phase 7.
- **2026-05-26 batch 2 (architecture pivot)**: `apps/video-worker` refactored — **Remotion deleted entirely**. New FFmpeg-first assembler. Replaces text-card slideshows with real-footage assembly. New `/assemble` endpoint replaces `/render`. Per-scene source resolution from `videoUrl|videoPath|imageUrl|imagePath` (still images → Ken-Burns; missing → fallback drawtext card). FFmpeg pipeline: per-scene encode → concat → caption burn-in via SRT/subtitles filter → faststart H.264+AAC. API client + render route handler updated; tests updated. 38/38 still passing.
  - Files added: `apps/video-worker/src/assembler.ts`, `source-resolver.ts`, `ffmpeg/{runner,probe,captions,assemble}.ts`. README rewritten.
  - Files removed: `apps/video-worker/src/{remotion/,render.ts,templates.ts,template-registry.ts}`. Remotion/React deps dropped from package.json.
  - Workspace check no longer expects deleted `services/{comfyui,postiz}/README.md` files (operator confirmed those were empty).
- **2026-05-26 batch 1**: Added 9 new API routes (visual asset approval; applications + answers CRUD; leads CRUD + PATCH; outreach messages CRUD + approval + manual-sent; unified calendar aggregator). +7 tests (38 total, all green).
- **Audit correction**: First audit reported several routes as missing that are actually present in `routes.ts`. Corrected below: `videos/assets/:id/approval`, `videos/assets/:id/attach-to-draft`, `videos/assets/:id/send-to-openpost`, the four `/decks` routes, and the two `/research-briefs` routes.

---

## 0. Health Snapshot

- `pnpm run check:workspace` — passes (40 sentinels)
- `pnpm run check:types` — passes
- `pnpm --filter @socialops/api test` — 31/31 passing
- API surface: `apps/api/src/routes.ts` (3,725 LOC) + `routes.test.ts` (1,573 LOC)
- Core schema: `packages/db/migrations/0001_socialops_core.sql` (654 LOC, ~45 tables)
- Operator CLI: `tools/socialops.mjs` (377 LOC) — the README-blessed primary path
- Web shell: `apps/web` is a 566-line Vite vanilla-TS demo of the video flow, **not** the Next.js App Router shell PLAN.md describes

---

## 1. Scoreboard

| Area | done | partial | missing | total |
| --- | ---: | ---: | ---: | ---: |
| Data models (PLAN.md §Data Models) | 31 | 2 | 0 | 33 |
| API routes (corrected + after batch 1) | 56 | 3 | 13 | 72 |
| Acceptance criteria (PLAN.md §V1) | 18 | 6 | 6 | 30 |
| Production build order (PLAN.md §Build Order) | 13 | 16 | 9 | 38 |
| PLAN1.md AI ad studio tools | 3 | 5 | 11 | 19 |
| VENDOR.md forks/services | 2 forked + 3 service-isolated | — | 25 | 30 |

---

## 2. Data Models — 31 done / 2 partial / 0 missing

Coverage is essentially complete vs. the spec.

- **partial — `VisualWorkflowTemplate`**: SQL table exists; no TS type in `packages/core/src/models.ts`; first-party templates live hardcoded in `apps/visual-worker/src/workflows.ts` so admins cannot CRUD them through the API. Add the TS type and admin routes.
- **partial — `VisualJob`**: spec calls for a dedicated job row; implementation reuses `visual_assets` for job state via `external_job_id` / status. Either rename in spec, or split into `visual_jobs` + `visual_assets` so polling/approval has a stable handle independent of asset lifecycle.

Bonus: schema also adds tables not in the spec but in the codebase (`brand_profiles`, `agency_clients`, `campaigns`, `media_assets`, `ugc_briefs`, `social_identities`, `entitlements`, `billing_customers`, `usage_events`). These are net positive.

---

## 3. API Routes — 38 done / 3 partial / 31 missing

### 3.1 done
Auth/meta, workspace CRUD, profile, career, brand, projects, capture notes, agency clients, campaigns, media assets, UGC briefs, content drafts (CRUD + approval + manual-publish + publish-package + metrics + OpenPost handoff + rank-x), content-engine planning, operator status, social identities + accounts, visuals (POST/GET/poll), video script (generate + approval), video jobs (create/get/render), video assets (list + export-package).

### 3.2 partial
- `POST /api/visuals/assets/:id/attach-to-draft` — handled indirectly via `POST /v1/workspaces/:id/content-drafts/:id/media-assets`. Add a first-class attach endpoint or document the redirect.
- `POST /v1/workspaces/:id/videos/assets/:id/send-to-openpost` — route exists, OpenPost media upload is not actually wired.
- Calendar — `ContentCalendarItem` table exists; no aggregated calendar endpoint that merges SocialOps drafts with OpenPost scheduled posts (V1 #14).

### 3.3 corrections (audit was over-pessimistic)

These routes were reported missing by the audit but exist in `routes.ts`:
- `POST /v1/workspaces/:id/videos/assets/:id/approval` (line 3032)
- `POST /v1/workspaces/:id/videos/assets/:id/attach-to-draft` (line 3052)
- `POST /v1/workspaces/:id/videos/assets/:id/send-to-openpost` (line 3177)
- `GET/POST /v1/workspaces/:id/decks` (lines 3286, 3292)
- `POST /v1/workspaces/:id/decks/:id/approval` (line 3329)
- `POST /v1/workspaces/:id/decks/:id/render` (line 3362)
- `GET/POST /v1/workspaces/:id/research-briefs` (lines 3435, 3441)

### 3.4 added in batch 1 (this session)

- `POST /v1/workspaces/:id/visuals/:assetId/approval`
- `GET/POST /v1/workspaces/:id/applications`
- `GET /v1/workspaces/:id/applications/:id`
- `GET/POST /v1/workspaces/:id/applications/:id/answers`
- `GET/POST /v1/workspaces/:id/leads`
- `PATCH /v1/workspaces/:id/leads/:id`
- `GET/POST /v1/workspaces/:id/outreach-messages`
- `POST /v1/workspaces/:id/outreach-messages/:id/approval`
- `POST /v1/workspaces/:id/outreach-messages/:id/manual-sent`
- `GET /v1/workspaces/:id/calendar` (merges `content_calendar_items` + scheduled `content_drafts`)

### 3.5 still missing — by area

**Analytics** (PLAN.md §Routes `/analytics`):
- `GET /v1/workspaces/:id/analytics` (aggregate `content_metrics`)

**Admin** (PLAN.md §Admin):
- `/v1/admin/users`, `/admin/workspaces`, `/admin/billing`, `/admin/usage`
- `POST /v1/admin/billing/:id/grant-plan|revoke-plan|reset-usage`
- Audit-log query endpoint

**Visual flow surface** (PLAN.md §AI Service Boundaries):
- `POST /api/social/openpost/upload-media|create-post|schedule-post` (image media bridge — text/video bridges exist)

**Video flow surface** (PLAN.md §Video Engine):
- Product demo: `create`, `:id/plan`, `:id/capture`, `:id/render` (no Playwright wiring)
- People video: `upload`, `transcribe`, `edit`, `render` (no Whisper wiring)
- Shorts: `script`, `render`
- Captions: `generate`
- Voiceover: `generate`
- B-roll: `plan`, `generate`

---

## 4. Acceptance Criteria — 18 done / 6 partial / 6 missing

### done (18)
#5 profiles, #6 projects, #7 capture notes, #9 source-of-truth generation, #10 LinkedIn/X/TikTok/carousel drafts, #11 approval queue entry, #12 approve/edit/reject, #13 push-to-OpenPost OR copy manually, #14 unified calendar (added batch 1), #15 visuals via ComfyUI service, #16 deck generation via API (audit correction — routes exist), #17 video script generation, #18 vertical captioned render via Remotion, #22 video approval workflow (audit correction — route exists), #24 free-tier limits block external AI video, #25 manual metric entry, #27 admin can manage (partial — see partial list), #30 nothing auto-posts.

### partial (6)
- #1 main UI is a Next.js shell — current `apps/web` is Vite vanilla TS demoing the video pipeline only
- #2 OpenPost runs as `/social` module — bridge client exists but no reverse-proxy mapping
- #3 register + create workspace — workspaces yes, registration is dev-header only
- #8 MiniClaw drawer with first-party skills — config exists, skill execution engine not wired
- #23 approved video to OpenPost media/scheduler OR manual export — `send-to-openpost` route exists but media upload to OpenPost not verified end-to-end
- #26 billing/entitlements OR manual fallback — entitlements yes, no admin grant endpoint
- #29 jobs/logs/backups exist — `usage_events`, `audit_logs` tables yes, no job queue runner / backup story

### missing (6)
- #4 onboarding state machine
- #19 product demo video (no Playwright wiring)
- #20 people video upload + caption flow (no Whisper)
- #21 attach ComfyUI visual into a VideoScene
- #27 admin console (no `/v1/admin/*` routes)
- #28 OAuth token encryption (status tracked, secret storage absent)

---

## 5. Build Order — 11 done / 17 partial / 10 missing

| # | Item | Status | Note |
| --: | --- | --- | --- |
| 1 | Monorepo normalized | done | pnpm + workspaces |
| 2 | OpenPost inspected/preserved | done | fork in `apps/openpost` with `007_socialops_post_metadata.sql` |
| 3 | OpenClaw untrusted skills disabled | partial | config exists; no enforcement |
| 4 | Next.js app shell | missing | `apps/web` is Vite vanilla TS |
| 5 | Core DB models | done | single 654-line migration covers all V1 tables |
| 6 | Auth/workspaces/RBAC | partial | workspaces + role enum yes; auth is dev-header |
| 7 | Onboarding | missing | — |
| 8 | Profile/project/capture | done | CRUD + tests |
| 9 | Reverse-proxy OpenPost under `/social` `/calendar` | missing | — |
| 10 | SocialOps→OpenPost bridge API | partial | content-draft → openpost route exists; per-resource bridge routes missing |
| 11 | ContentDraft + approval/manual/provenance | done | full status lifecycle, transitions, audit log entries |
| 12 | MiniClaw integration for AI generation | partial | generation is API-side via prompts package; no MiniClaw HTTP call |
| 13 | Generation templates by mode | done | `packages/prompts/src/templates.ts` |
| 14 | Approval queue | partial | `approval_items` populated; no queue endpoint or UI |
| 15 | Manual publish/copy tracker | partial | manual-publish route + publish-package; no UI |
| 16 | VisualWorkflowTemplate/Job/Asset/Bridge | partial | assets done; workflow templates hardcoded; bridge to OpenPost missing |
| 17 | First static ComfyUI workflow template | done | 15 templates in `apps/visual-worker/src/workflows.ts` |
| 18 | visual-worker generate/poll/save | done | server.ts + comfy.ts + storage; dry-run mode for tests |
| 19 | Show visual preview in SocialOps | missing | no UI |
| 20 | Approve/reject + attach-to-draft | partial | attach via media-assets route; no dedicated approval route |
| 21 | Upload approved asset to OpenPost media | missing | — |
| 22 | deck-worker with Marp/Slidev | partial | deps installed, render endpoint exists; templates/tests absent |
| 23 | VideoScript generation | done | route + tests |
| 24 | VideoTemplate registry | done | seeded |
| 25 | Remotion + FFmpeg render | partial | Remotion bundler/render wired; **Remotion templates not present** in `apps/video-worker/src/remotion/`; FFmpeg post-process stubbed |
| 26 | VideoJob queue/status + preview | partial | jobs CRUD yes; UI absent |
| 27 | Attach VideoAsset + OpenPost bridge | partial | bridge row exists; OpenPost upload missing |
| 28 | ComfyUI thumbnail/background/b-roll via visual-worker | partial | b-roll workflow keys exist (`wan-i2v-broll`, `ltxv-fast-motion-broll`); video pipeline does not call them |
| 29 | Playwright product screenshot/demo capture | missing | — |
| 30 | User-upload people video captions/edit | missing | — |
| 31 | Avatar + external AI video adapters | partial | provider stubs only |
| 32 | CRM + outreach drafts | partial | tables yes; routes no |
| 33 | Billing/entitlements/usage limits/manual fallback | partial | entitlements + usage enforced; no admin grant; no payment provider adapter |
| 34 | Analytics for manual + connected metrics | partial | manual entry yes; connected sync no |
| 35 | Admin console | missing | — |
| 36 | Security hardening | partial | OpenPost shared-token; no encrypted token storage; no rate limiting middleware |
| 37 | Backups/monitoring/logs/health | partial | `infra/backups`, `infra/monitoring` directories exist; not exercised |
| 38 | Production deploy | partial | `infra/compose/socialops.production.example.yml` present; no docs/health checks |

---

## 6. Workers — what's actually inside

### `apps/visual-worker`
- HTTP server with `/health`, `/templates`, `/generate`, `/poll`
- ComfyUI client (`comfy.ts`) for `/prompt`, `/history`, `/view`
- Workflow template registry with 15 keys (9 from PLAN.md + 6 bonus including Wan/LTX b-roll)
- Local FS save with public URL config; dry-run mode for tests
- **Gaps:** no approval enforcement, no OpenPost media handoff, no per-workspace ComfyUI queue isolation

### `apps/video-worker`
- Single `/render` endpoint
- Remotion 4.0.462 bundler + renderer
- **Gaps:** Remotion template `.tsx` files not present; FFmpeg post-processing stubbed (no caption burn-in, no resize, no trim, no CTA cards); does not call visual-worker for b-roll; no scene/caption type definitions

### `apps/deck-worker`
- `/render` endpoint; Marp + Slidev CLIs as deps
- **Gaps:** template registry minimal; not exercised by tests; PDF export path unclear

### `apps/openpost` (MIT fork)
- SocialOps middleware: `X-SocialOps-Internal-Token` shared-secret auth
- Migration `007_socialops_post_metadata.sql` adds `approval_status`, `manual_publish_status`
- **Gaps:** no reverse-proxy under `/social`; no `/api/social/schedule|media|accounts` bridge in main API; no scheduled-post sync back for metrics

### `apps/claw` (MIT MiniClaw fork)
- Fork present with `socialops/miniclaw.config.example.json` (disables ClawHub)
- One first-party skill at `apps/claw/skills/socialops-generate-draft/SKILL.md`
- **Gaps:** no HTTP client from SocialOps API to MiniClaw; no enforced skill allowlist; first-party skills for `generate_linkedin_post`/`generate_x_post`/etc. (listed in PLAN.md §544–562) not implemented

---

## 7. PLAN1.md AI Ad Studio — 3 done / 5 referenced / 11 missing

| Tool | Status | Note |
| --- | --- | --- |
| ComfyUI | done | service-isolated; used by visual-worker |
| FFmpeg | partial | system dep; not exercised in pipelines |
| Remotion | done | inside video-worker |
| Wan2.2 TI2V/I2V | referenced | Together API extension in MiniClaw; no local checkpoints |
| HunyuanVideo-1.5 | referenced | spec mention only |
| LTX-Video | referenced | workflow preset key only |
| WanGP | missing | — |
| rembg | missing | — |
| kohya_ss | missing | — |
| MuseTalk | missing | — |
| LivePortrait | missing | — |
| OpenVoice | missing | — |
| Piper | missing | — |
| Whisper / WhisperX | missing | needed for caption flow (#20) |
| Kdenlive | missing | manual editor; not codebase concern |
| RIFE | missing | — |
| Blender | missing | manual; not codebase concern |
| Krita | missing | manual; not codebase concern |

**Workflow readiness:**
- **PLAN1 #1 AI product video (no human):** partial — ComfyUI + Remotion path possible; rembg/Kdenlive/RIFE absent
- **PLAN1 #2 AI UGC-style:** missing — no TTS, no MuseTalk, no LivePortrait
- **PLAN1 #3 LoRA-consistent product:** missing — no kohya_ss path

---

## 8. VENDOR.md — 2 forked / 3 service-isolated / 25 not started

### Forked (MIT, in core)
- OpenPost → `apps/openpost`
- OpenClaw → `apps/claw` (MiniClaw)

### Cloned / service-isolated (license-correct)
- ComfyUI (GPL-3.0) → `ComfyUI/`, separate service per compose example
- Postiz (AGPL-3.0) → `postiz-app/`, kept as reference only — **good**
- PokeeResearchOSS (Apache-2.0) → `PokeeResearchOSS/`, separate service

### Not started
- Marp, Slidev, Excalidraw, Umami, Chatwoot (MIT, Fork-Now tier)
- Plunk, listmonk, Formbricks, Mautic, FreeScout, Twenty CRM (separate-service tier)
- PostHog, n8n, Directus (use-carefully tier — three of these are intentionally avoided per spec)
- Postfix, Dovecot, Rspamd (optional email infra — intentionally avoided)

**License risk: clean.** GPL/AGPL projects are all service-boundary isolated; no copy-into-core violations detected.

---

## 8.5 Batch 1 deltas (this session)

| Build-order # | Item | Before → After |
| ---: | --- | --- |
| 14 | Approval queue routes | partial → done (visual + outreach approval added; queue endpoint still missing) |
| 16 | VisualWorkflowTemplate / Job / Asset / Bridge | partial → partial (asset approval added; bridge still missing) |
| 22 | deck-worker | partial → done (audit correction — routes already wired) |
| 32 | CRM + outreach drafts | partial → done (leads + outreach CRUD + approval + manual-sent) |

V1 acceptance: #14, #16, #22 flipped to done. +3 done, -3 missing.

## 9. Recommended Order of Attack

Roughly: ship the internal-loop README priority first, then catch up to PLAN.md V1 acceptance.

1. ~~**Approval routes for visuals + videos.**~~ — done batch 1 for visuals; videos was already done.
2. ~~**CRUD: applications, leads, outreach, calendar.**~~ — done batch 1.
3. **Make video pipeline real.** Add Remotion template `.tsx` files (career-lesson-vertical, linkedin-update, founder-update, product-demo, project-build-log) under `apps/video-worker/src/remotion/`, wire FFmpeg caption burn-in + resize + trim. This unblocks build-order #25, AC #18 reality vs. demo.
4. **OpenPost media bridge.** `POST /api/social/openpost/upload-media|create-post|schedule-post` in `apps/api`, calling the OpenPost fork with the existing internal-token. Closes V1 #23 fully.
5. **Admin surface.** `/v1/admin/*` + audit-log read endpoint. Closes V1 #27.
6. **Analytics aggregator.** `GET /v1/workspaces/:id/analytics` rolling up `content_metrics`. Closes V1 partial.
7. **Auth real-ness.** Replace dev-header with email/password + sessions; encrypt OAuth tokens at rest. Closes V1 #3, #28.
8. **Web shell.** Decide: keep Vite shell (operator-only product) or scaffold the Next.js App Router shell PLAN.md describes. README signals operator-only is fine for now.
9. **PLAN1 capture flow:** Whisper integration so user-uploaded people video produces captions (V1 #20). Smallest PLAN1 win that unlocks a real video format.
10. **MiniClaw HTTP integration.** Move generation off API-internal templates onto the MiniClaw service with enforced first-party skill allowlist. Closes V1 #8 and build-order #3, #12.

Items 3–6 are mostly mechanical against existing schema and don't require new dependencies. Items 7–10 are larger and warrant their own design pass.
