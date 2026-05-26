# Visual Worker

The visual worker is the only SocialOps component that talks directly to
ComfyUI.

Flow:

```txt
SocialOps ContentDraft
  -> VisualWorkflowTemplate + prompt
  -> VisualJob
  -> visual-worker
  -> ComfyUI internal API
  -> VisualAsset
  -> SocialOps media library
  -> OpenPost media bridge / manual export
```

Responsibilities:

- store allowlisted ComfyUI workflow templates
- receive `VisualJob` requests from SocialOps
- call ComfyUI API over the internal network
- submit workflows to `/prompt`
- track progress through `/ws` or `/history/{prompt_id}`
- fetch generated files through `/view`
- save generated files to SocialOps storage
- create `VisualAsset` records
- attach approved assets to content drafts and the OpenPost media library
- enforce plan usage limits

ComfyUI code remains in `ComfyUI` or a separate container runtime.

Environment:

```txt
COMFYUI_URL=http://comfyui:8188
VISUAL_STORAGE_PATH=/generated
PUBLIC_MEDIA_BASE_URL=...
OPENPOST_API_URL=...
OPENPOST_API_KEY=...
VISUAL_WORKER_ALLOW_INLINE_WORKFLOW=false
```

Local commands:

```txt
pnpm --filter @socialops/visual-worker dev
pnpm --filter @socialops/visual-worker check
pnpm --filter @socialops/visual-worker build
```

HTTP surface:

- `GET /health`
- `GET /templates`
- `POST /generate`
- `POST /poll`

`/generate` supports `dryRun: true` so local development can validate the
SocialOps API/worker boundary without a running ComfyUI instance. Production
generation submits allowlisted workflow templates to ComfyUI `/prompt`.

First workflow templates:

- `linkedin-career-card`
- `linkedin-carousel-cover`
- `x-founder-post-image`
- `x-thread-cover`
- `tiktok-thumbnail`
- `instagram-carousel-slide`
- `project-update-card`
- `market-map-card`
- `product-demo-thumbnail`
- `wan-i2v-broll`
- `ltxv-fast-motion-broll`

The Wan/LTXV templates are Comfy API prompt templates for local video b-roll.
They require model files to be installed in the cloned `ComfyUI/models`
directory before non-dry-run generation will work.

Expected model filenames used by the first templates:

- `ComfyUI/models/diffusion_models/wan2.1_i2v_480p_14B_fp8_e4m3fn.safetensors`
- `ComfyUI/models/text_encoders/umt5_xxl_fp8_e4m3fn_scaled.safetensors`
- `ComfyUI/models/vae/wan_2.1_vae.safetensors`
- `ComfyUI/models/diffusion_models/ltxv-13b-0.9.8-distilled-fp8.safetensors`
- `ComfyUI/models/text_encoders/t5xxl_fp8_e4m3fn.safetensors`
- `ComfyUI/models/vae/ltxv_vae.safetensors`

Use `dryRun: true` until those files are present. Product UI still must come
from real screenshots or screen recordings; these workflows are for supporting
b-roll and motion clips.

Security rules:

- do not expose ComfyUI publicly
- do not allow users to upload arbitrary ComfyUI workflows
- do not allow users to install arbitrary custom nodes
- do not let prompts execute shell/code
- use first-party/admin-created workflow templates only
- rate-limit generation by plan
- log every generation and failure
- if generation fails, keep the text draft schedulable and allow retry/manual
  upload
