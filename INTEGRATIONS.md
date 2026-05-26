# SocialOps Integration Workspace

This workspace can vendor external tools for local research and integration.

## Cloned Tools

### Video Engine

SocialOps video is rendered by `apps/video-worker`, not directly by the
frontend and not directly by ComfyUI.

Production flow:

```txt
ContentDraft
  -> VideoScript
  -> VideoJob
  -> Remotion render
  -> FFmpeg post-processing
  -> VideoAsset
  -> approval
  -> OpenPost media bridge or manual export
```

ComfyUI can provide thumbnails, b-roll images, generated scene visuals, and
optional image-to-video assets through `apps/visual-worker`. Product demo videos
must use real screenshots or screen recordings captured with Playwright rather
than AI-generated fake UI. People/avatar videos require user-uploaded media or
explicit consent-based provider flows.

### ComfyUI

Repository:

```txt
https://github.com/comfyanonymous/ComfyUI.git
```

Role in SocialOps:

- generate visual assets for posts
- create image prompts and reusable workflows
- support carousel and short-form content visuals

Architecture boundary:

- `apps/visual-worker` is the only direct ComfyUI client.
- SocialOps frontend and OpenPost frontend must not call ComfyUI directly.
- SocialOps API creates `VisualJob` records through `/api/visuals/*`.
- Visual Worker submits allowlisted workflow templates to ComfyUI over the
  internal network.
- Generated files become SocialOps `VisualAsset` records before they are
  attached to drafts or uploaded to OpenPost media.
- Do not expose ComfyUI port `8188` publicly.
- Do not allow normal users to upload arbitrary ComfyUI workflows or install
  custom nodes.

Worker API flow:

```txt
POST /prompt
poll /history/{prompt_id} or track /ws
GET /view
save to SocialOps storage
create VisualAsset
approve/reject
upload approved asset to OpenPost media bridge
```

Expected local path:

```txt
vendor/ComfyUI
```

Local setup status:

```txt
Python venv: vendor/ComfyUI/.venv
Python: 3.11.14
PyTorch: installed
Apple MPS: available
```

Useful commands:

```bash
source vendor/ComfyUI/.venv/bin/activate
python vendor/ComfyUI/main.py --cpu
```

Run without `--cpu` when using Apple Silicon/MPS or another supported GPU.
Models still need to be downloaded into ComfyUI's `models/` folders before
image generation will be useful.

### Postiz

Repository:

```txt
https://github.com/gitroomhq/postiz-app.git
```

Role in SocialOps:

- reference implementation for social scheduling/publishing architecture
- possible integration layer for allowed publishing workflows
- useful product comparison for calendar, approvals, and analytics

Expected local path:

```txt
vendor/postiz-app
```

Local setup status:

```txt
Node: 22.12.0
pnpm: 10.6.1
Dependencies: installed
Prisma client: generated
```

Useful commands:

```bash
cd vendor/postiz-app
source ~/.nvm/nvm.sh
nvm use
pnpm run dev:docker
pnpm run dev
```

Postiz needs its Docker services and environment variables before the full app
can run locally. Start with `vendor/postiz-app/.env.example`, then create a
local `.env` with matching database, Redis, JWT, and URL settings.

### PokeeResearchOSS

Repository:

```txt
https://github.com/Pokee-AI/PokeeResearchOSS.git
```

Role in SocialOps:

- deep research engine for topic research and market/background research
- citation-rich research briefs before generating posts, carousels, and scripts
- validation layer for claims used in public content
- source gathering for newsletter drafts, application answers, and founder updates

Expected local path:

```txt
vendor/PokeeResearchOSS
```

Local setup status:

```txt
Repository: cloned
Submodule: vendor/PokeeResearchOSS/verl initialized
Runtime: Docker-based, GPU-oriented
Model: PokeeAI/pokee_research_7b
```

Required credentials:

```txt
SERPER_API_KEY
JINA_API_KEY
GEMINI_API_KEY
Hugging Face token with access to PokeeAI/pokee_research_7b
```

Useful commands from the Pokee README:

```bash
cd vendor/PokeeResearchOSS
python start_tool_server.py --enable-cache
python cli_app.py --question "Research this topic for a LinkedIn post"
```

The full benchmark/evaluation flow expects a Docker GPU environment. For
SocialOps, use Pokee as a separate research service or reference
implementation, not as embedded core app code.

## Guardrails

- Do not build browser-based auto-posting.
- Do not build spam automation.
- Do not auto-DM.
- Keep human approval in the publishing loop.
- Use external repositories as references or integrations, not as a reason to
  abandon SocialOps product ownership.
