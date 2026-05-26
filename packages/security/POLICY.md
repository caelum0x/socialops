# SocialOps Security Policy

SocialOps is approval-first software.

Hard rules:

- AI may draft content; AI may not publish, send, scrape, or DM without explicit
  user approval.
- Do not build browser automation for LinkedIn, X, Instagram, TikTok, or email.
- Do not build LinkedIn scraping or account scraping.
- Do not auto-send cold email or direct messages.
- Only schedule or publish through official OAuth/API integrations where
  supported by the platform.
- Manual copy/export mode must always exist.
- OAuth tokens and provider secrets must be encrypted at rest.
- ComfyUI, MiniClaw, Postiz, PokeeResearch, and other sidecars must not expose
  admin/runtime ports publicly.
- MiniClaw third-party/public skills are disabled by default. Only first-party
  SocialOps skills are allowed in production config.
- User prompts must not trigger arbitrary shell commands.

AI claim policy:

- Do not invent revenue, customers, degrees, employers, funding, follower counts,
  awards, testimonials, logos, or traction.
- If a claim is missing, mark the output as `needs_missing_info`.
- Use approved claims and forbidden claims from the active project/profile before
  generating public-facing content.
