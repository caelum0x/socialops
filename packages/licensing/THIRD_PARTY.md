# Third-Party License Inventory

SocialOps is built by adapting existing systems, but the code boundaries must
match the licenses.

| Component | Path | License | SocialOps use |
| --- | --- | --- | --- |
| OpenPost | `apps/openpost` | MIT | Direct fork and scheduler foundation. |
| OpenClaw | `apps/claw` | MIT | Direct fork as MiniClaw assistant/control plane. |
| ComfyUI | `ComfyUI` | GPL-3.0 | Separate internal visual service called by API. Do not merge into core app. |
| Postiz | `postiz-app` | AGPL-3.0 | Posting service boundary. Do not copy into proprietary core. |
| PokeeResearchOSS | `PokeeResearchOSS` | Apache-2.0 | Separate research service called by API. |
| Remotion | not vendored yet | Remotion license | Video worker dependency; confirm commercial team-size terms before paid scale. |
| Marp | not vendored yet | MIT | Deck worker renderer. |
| Slidev | not vendored yet | MIT | Technical/demo deck renderer. |
| Excalidraw | not vendored yet | MIT | Diagram/carousel visual source. |
| Umami | not vendored yet | MIT | Optional analytics service. |

## ComfyUI Custom Nodes

Optional ComfyUI custom nodes are tracked in
`comfyui-extensions/manifest.json` and installed only under
`ComfyUI/custom_nodes`.

Current status: no third-party custom nodes are approved or installed. The
NVIDIA RTX node package is tracked but disabled because the current development
machine is a MacBook without NVIDIA hardware.

Tracked candidates/rejections live in `comfyui-extensions/manifest.json`.
Official Comfy-Org repo decisions are documented in
`comfyui-extensions/OFFICIAL_REPOS.md`.

Rules:

- MIT foundations can be forked and modified directly.
- GPL and AGPL systems stay as separate services unless the business explicitly
  chooses a compatible open-source licensing strategy for the whole combined
  product.
- ComfyUI custom nodes must have a verified license before install, and their
  use must stay behind the ComfyUI service/API boundary.
- OAuth tokens, provider secrets, and generated media ownership stay inside the
  SocialOps source-of-truth database/storage, not in untrusted sidecar state.
