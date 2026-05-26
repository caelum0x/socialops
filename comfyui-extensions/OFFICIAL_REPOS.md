# Official Comfy-Org Repo Use Plan

The Comfy-Org account has many repositories. SocialOps should use only the
pieces that directly support the separate ComfyUI media runtime.

## Use Now

| Repo | License | SocialOps use | Boundary |
| --- | --- | --- | --- |
| `ComfyUI` | GPL-3.0 | Media generation runtime | Separate service only |
| `workflow_templates` | MIT | First-party workflow/template source | Can copy/adapt templates with attribution |

## Candidate

| Repo | License | SocialOps use | Boundary |
| --- | --- | --- | --- |
| `Nvidia_RTX_Nodes_ComfyUI` | Apache-2.0 | Optional accelerated image/video workflows | Disabled until NVIDIA/cloud GPU runtime exists |
| `example_workflows` | Not declared through GitHub API | Reference workflows | Review license before copying |

## Do Not Install In Production By Default

| Repo | License | Reason |
| --- | --- | --- |
| `ComfyUI-Manager` | GPL-3.0 | Installs arbitrary custom nodes; SocialOps needs an explicit approval manifest instead |
| `comfy-remote-nodes` | GPL-3.0 | Remote node execution requires a separate security design |
| `ComfyUI_frontend` | GPL-3.0 | The SocialOps app should not merge the Comfy frontend into core |
| `comfy-cli` | GPL-3.0 | Useful developer tooling, not a production dependency |
| `docs` | GPL-3.0 | Documentation reference only |

## Rule

If a Comfy repo is not listed here or in `manifest.json`, do not clone it into
the runtime. Add it as a candidate first, verify license and security impact,
then install only through `pnpm run comfy:install-extension <key>`.

## Current Hardware Default

Current development hardware is a MacBook, not a dedicated GPU machine.

Default runtime profile:

```txt
SOCIALOPS_MEDIA_RUNTIME_PROFILE=macbook_local
SOCIALOPS_ALLOW_HEAVY_MEDIA_WORKFLOWS=false
```

This means SocialOps can store and approve image/video/audio/voice workflow
plans, but the API should only queue lightweight image/text-visual Comfy
workflows by default. Heavy video, voice, audio, RTX, or arbitrary custom
workflows require an explicit GPU/cloud runtime change.
