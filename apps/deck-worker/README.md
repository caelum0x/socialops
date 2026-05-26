# Deck Worker

Use the real Marp and Slidev projects for rendering. This worker is only the
SocialOps bridge around those vendor CLIs; it is not a lookalike deck renderer.

Deck types:

- career portfolio deck
- founder pitch deck
- startup pitch deck
- investor update deck
- project demo deck
- accelerator application deck
- internship/job portfolio deck

Deck claims must come from approved project/profile data.

HTTP surface:

- `GET /health`
- `POST /render`

Renderers:

- `marp` -> `@marp-team/marp-cli`
- `slidev` -> `@slidev/cli`

Local commands:

```txt
pnpm --filter @socialops/deck-worker dev
pnpm --filter @socialops/deck-worker check
pnpm --filter @socialops/deck-worker build
```
