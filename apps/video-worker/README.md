# Video Worker

FFmpeg-first video assembler. Remotion was removed — text-card slideshows lose on
TikTok / Reels / LinkedIn. Real videos come from real footage.

## Pipeline

```txt
ContentDraft
  -> VideoScript (LLM hook, narration, captions, scenes)
  -> per-scene SOURCE resolution
       1. Playwright screen recording (apps/video-worker future module)
       2. Operator-uploaded clip (media_assets.url)
       3. AI clip from external API (Runway / Luma / Pika) — paid plans
       4. AI clip from local ComfyUI Wan2.2 / LTX-Video — GPU only
       5. Still image (Ken-Burns zoom into a clip)
       6. fallback solid-color drawtext card (signals "no real footage yet")
  -> FFmpeg assembler
       - per-scene encode (scale + crop + drawtext + fps lock)
       - concat into single timeline
       - burn-in line captions from caption_segments
       - mix optional voiceover / audio
       - H.264 + AAC + yuv420p + +faststart
       - per-platform aspect (9:16, 16:9, 1:1, 4:5)
  -> VideoAsset
  -> approval
  -> OpenPost media bridge OR manual export package
```

The assembler accepts scenes with one of: `videoUrl`, `videoPath`, `imageUrl`,
`imagePath`. Scenes with no source render a fallback solid-color drawtext card
so the pipeline never silently fails; the operator is nudged to provide real
footage.

## Endpoints

- `GET /health` — liveness + ffmpeg path
- `POST /assemble` — primary; see `src/video-types.ts` for the `AssembleRequest`
  schema.

## Configuration

| Env | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3003` | HTTP listen port |
| `VIDEO_STORAGE_PATH` | `/tmp/socialops-rendered-video` | Final MP4 output dir |
| `VIDEO_SCRATCH_PATH` | `/tmp/socialops-video-scratch` | Per-job temp + cached downloads |
| `PUBLIC_MEDIA_BASE_URL` | empty | If set, returned `publicUrl` is `<base>/<file>` |
| `FFMPEG_PATH` | `ffmpeg` | FFmpeg binary (LGPL build expected) |
| `VISUAL_WORKER_URL` | `http://localhost:3002` | For future b-roll resolution |
| `OPENPOST_API_URL` | `http://localhost:8080` | For future direct upload (today handled by API) |
| `OPENPOST_API_KEY` | empty | Reserved |

## Future modules (planned, see `docs/TODO.md`)

- `src/playwright/` — controlled-viewport screen capture (Phase 4)
- `src/providers/runway.ts`, `luma.ts`, `pika.ts`, `heygen.ts` — paid external
  clip providers (Phase 12)
- `src/comfyui-client.ts` — local Wan2.2 / LTX-Video b-roll source (Phase 12,
  GPU host only)
- `src/overlays/` — Remotion-rendered PNG-with-alpha title cards / lower-thirds
  overlaid via FFmpeg (optional, polish)

## Safety rules

- Product videos must use real screenshots / screen recordings, not AI-hallucinated UI.
- People videos must use user-uploaded video/audio or consent-based avatar providers.
- No fake testimonials. No public-figure impersonation. No cloned voices without consent.
- Expensive external AI video providers require paid plan credits.
- All rendered videos require human approval before scheduling or export-as-ready.

Do not auto-publish rendered videos.
