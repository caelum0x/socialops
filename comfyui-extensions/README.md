# SocialOps ComfyUI Extensions

This directory tracks optional ComfyUI custom nodes and model stacks used by the
separate ComfyUI service runtime.

Rules:

- Do not copy custom-node code into the SocialOps core app.
- Clone custom nodes only into `vendor/ComfyUI/custom_nodes`.
- Add every extension to `manifest.json` before install.
- Record license, source URL, allowed media kinds, and workflow presets.
- Keep extensions disabled until a workflow key explicitly depends on them.
- Never expose ComfyUI or custom-node admin surfaces publicly.

The SocialOps API only accepts first-party workflow keys or explicit `custom:*`
workflow keys. This keeps ComfyUI flexible while making dependency and license
risk visible.
