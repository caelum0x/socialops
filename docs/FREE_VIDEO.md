# Free / Cheap AI Video for SocialOps

Honest operator's guide. Updated 2026-05-27.

## TL;DR — what to do today

1. **Generate clips on Kling AI** (klingai.com — free, 60 generations/day).
2. **Download the MP4.**
3. **`POST /v1/workspaces/:id/videos/people/upload`** with the MP4's URL (or any object-storage URL you control).
4. SocialOps assembles, burns captions, exports per platform.

Total cost: **$0.** No API keys needed. This is the fallback the `manual` provider tells you about.

If you want it automated through the SocialOps API, set `KLING_AI_ACCESS_KEY` + `KLING_AI_SECRET_KEY` (paid, but cheapest API path) and the same `POST /v1/workspaces/:id/videos/broll/generate` call works.

---

## Why local generation does not work on your MacBook Air

Diffusion video models (Wan2.2, HunyuanVideo, LTX-Video, Mochi, CogVideoX) need
**12–24 GB VRAM** and CUDA. MacBook Air has unified memory but no NVIDIA GPU.
PyTorch's MPS backend either crashes or runs at < 0.01x realtime on these
models. Don't try.

Realistic local-on-Mac options:
- Stable Video Diffusion via MPS — works on M2/M3 24GB Air but ~5 min per 4s clip; not viral-quality.
- AnimateDiff via MLX — text-to-2D-animation, looks like 2023 footage.
- CogVideoX-2B via MLX — experimental; quality below the free APIs.

**Conclusion:** for SocialOps quality, use cloud. Either a free-tier web UI + manual upload, or one of the API adapters below.

---

## How Runway / Luma / Pika / Higgsfield / Kling actually create those videos

All five are **diffusion video models**. Architecture: latent diffusion +
Transformer (DiT). They took an open architecture (similar to what
Wan2.2 / HunyuanVideo are) and fine-tuned it on a **private dataset of
cinematic camera moves and motion-tagged video**.

That's the secret. There is no magic algorithm. Higgsfield specifically markets
its motion control as "trained on movie camera moves" — they curated 100k+
hours of footage tagged by camera action (push-in, dolly, orbit, crash zoom,
etc.) and trained a LoRA on top.

You can approximate this **freely** via:
- Open-weight model on Replicate / fal.ai with strong motion prompting
- Kling AI free tier (which already has those motion controls built in)
- Hailuo (MiniMax) Video-01 Director model (has explicit camera controls)

---

## Adapter ranking (cheapest-first, ready in `apps/api/src/video-providers.ts`)

| Rank | Provider | Env vars | Cost | Quality | Catch |
| ---: | --- | --- | --- | --- | --- |
| 1 | **Kling AI** | `KLING_AI_ACCESS_KEY` + `KLING_AI_SECRET_KEY` | ~$0.01/sec via API, 60 free/day on web | Luma-tier, often better | Web UI is best free path |
| 2 | **Hailuo MiniMax** | `HAILUO_API_KEY` | Cheap, free tier on web | Strong I2V; Director model gives explicit camera control | China-based; latency varies |
| 3 | **Replicate** | `REPLICATE_API_TOKEN` (+ optional `REPLICATE_MODEL_DEFAULT`) | $0.01–0.20/clip | Hosts Wan2.2 / Hunyuan / LTX / Mochi / CogVideoX | Default model can be any open vid model |
| 4 | **fal.ai** | `FAL_API_KEY` | $0.05–0.20/clip | LTX-Video by default; many open models | Cheaper than Runway for the same models |
| 5 | **HuggingFace Spaces** | `HUGGINGFACE_SPACE` (+ optional token) | $0 | Whatever's hosted | Rate-limited; Spaces go offline regularly |
| 6 | **Higgsfield** | `HIGGSFIELD_API_KEY` | Credit-based, $10/100 credits | Best motion control | Public API recently launched, contract may shift |
| 7 | **Runway Gen-3** | `RUNWAY_API_KEY` | $0.05/sec, ~$5 for 100s | Premium quality | $15/mo minimum, no real free tier |
| 8 | **Luma Dream Machine** | `LUMA_API_KEY` | $0.04/sec | Good | **Blocked in Turkey + several regions; site frequently down** |
| 9 | **Pika via Fal.ai** | `PIKA_API_KEY` | $0.10/clip | Pika 1.5 | Use the fal.ai adapter instead |
| 10 | **ComfyUI Wan I2V (local)** | none — `visual-worker` runs ComfyUI | $0 | Top-tier with right LoRA | Requires NVIDIA GPU — **not your Mac** |
| 11 | **Manual** | none | $0 | Anything you can use | You generate elsewhere, upload via `/videos/people/upload` |

The router picks **first ready** by default. Order above is the preference
sequence — Kling first, Hailuo second, Replicate third, etc.

To force a specific provider per request:

```http
POST /v1/workspaces/:id/videos/broll/generate
{
  "source_image_url": "https://media/your-product-hero.jpg",
  "prompt": "VCPeer terminal closeup, premium SaaS dashboard aesthetic",
  "motion_preset": "crash_zoom",
  "provider": "replicate",
  "aspect_ratio": "9:16",
  "duration_seconds": 4
}
```

---

## Free-tier deep dive

### Kling AI (klingai.com)

- **Web UI:** 60 image-to-video generations per day. Daily reset. No CC required, phone verify only.
- **API:** Paid. JWT-signed with `accessKey` + `secretKey` from kling-team console.
- **Quality:** Often better than Luma in 2026. Strong motion fidelity.
- **Use case:** Daily content for one operator. 60/day is more than enough.

### Hailuo (MiniMax)

- **Web UI (hailuoai.com):** ~10 free generations/day.
- **API:** `api.minimaxi.chat`, `Video-01-Director` model has explicit camera-move parameters.
- **Quality:** Similar to Luma; great for product b-roll.

### Replicate (replicate.com)

- **Free credit on signup:** $0.10 (covers ~1 Wan2.2 5B clip).
- **Pricing:** Per-second of CPU/GPU billing. Wan2.2 5B = ~$0.05/clip. LTX-Video = ~$0.01/clip.
- **Hosts:** lucataco/wan-2.2-5b-i2v, fofr/ltx-video, tencent/hunyuanvideo, genmo/mochi-1, zhipuai/cogvideox-5b, plus 30+ more.
- **Use case:** Best programmatic path with model variety. Set `REPLICATE_MODEL_DEFAULT` to any model on replicate.com to swap.

### fal.ai

- **Free credit:** $1 on signup.
- **Pricing:** LTX-Video = ~$0.05/clip, Pika = ~$0.20, Hunyuan = ~$0.15.
- **Latency:** Often faster than Replicate for the same model.

### HuggingFace Spaces

- **Cost:** $0 (community-hosted).
- **Caveats:** Rate limits, downtime when Spaces sleep, no SLA.
- **Use case:** Truly-free fallback when API budget is gone. Find a Space at huggingface.co/spaces?search=video and set `HUGGINGFACE_SPACE=Wan-AI/Wan2.2-TI2V-5B` (or similar).
- **Quality:** Same model as paid APIs; different uptime.

---

## Why Luma Dream Machine probably did not open for you

Luma actively blocks signups from:
- Turkey, Russia, Iran, China, North Korea
- Several other regions during compliance scans

Plus the service has been intermittent in 2025–2026. If you're in Turkey,
**use Kling or Hailuo instead** — both work fine globally.

A VPN bypasses the signup block but violates Luma's TOS, so we don't recommend it.

---

## The truly-zero-cost daily workflow

```
1. Take a product photo on your phone, or screenshot VCPeer / Recoder / SocialOps.
2. Upload it somewhere you have a public URL (S3, Cloudflare R2, even a public Discord channel).
3. Open klingai.com (or hailuoai.com).
4. Paste the URL as the start frame.
5. Pick "Camera Movement: Push In" (or whatever motion you want).
6. Generate. Download MP4 when done (~2 min).
7. Get the MP4 to a URL too (same way).
8. POST /v1/workspaces/:id/videos/people/upload
   { "url": "https://...mp4", "file_name": "clip.mp4", "mime_type": "video/mp4",
     "media_kind": "video", "is_real_user": true }
9. POST /v1/workspaces/:id/videos/people/render
   with scenes pointing at the uploaded media_asset_id.
10. SocialOps assembles, burns captions, exports per platform.
```

Cost: **$0**. Time: ~5 minutes per clip end-to-end.

Once you want it automated: set `KLING_AI_ACCESS_KEY` + `KLING_AI_SECRET_KEY`
and call `/videos/broll/generate` instead of doing steps 3–7 manually. The API
costs about $0.01–0.05 per clip — cheaper than the time you save.

---

## What about Higgsfield-quality "robo arm" / "vortex" specifically

Those are motion-LoRAs trained on movie camera moves. Two ways to get them
freely:

1. **Kling AI's camera_control parameter** already supports `push_in`, `pull_out`, `orbit`, `pan_left/right`, `tilt_up/down`, `zoom_in/out`, and combined motions. Less variety than Higgsfield but enough for 90% of ad shots.
2. **Replicate hosts community motion LoRAs** on top of Wan2.2 — search `wan-2.2-motion-lora` on replicate.com. Often $0.02 per clip.

The `motion_preset` parameter on `/videos/broll/generate` maps to the right
provider-specific params for each one. See `apps/api/src/motion-presets.ts`.

---

## Anti-pattern: do not pay for Sora / Veo3 yet

OpenAI Sora and Google Veo3 cost $20-50 per minute of output and the API
quotas are tiny. Pay for them only when a specific viral concept demands their
look. For daily content, Kling + Replicate covers 95% of needs at ~1% the cost.
