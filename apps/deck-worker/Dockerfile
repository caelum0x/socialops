FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/deck-worker/package.json apps/deck-worker/package.json
RUN corepack enable && pnpm install --filter @socialops/deck-worker... --frozen-lockfile

FROM deps AS build
COPY apps/deck-worker apps/deck-worker
RUN pnpm --filter @socialops/deck-worker build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium ca-certificates fonts-liberation \
  && rm -rf /var/lib/apt/lists/*
ENV CHROME_PATH=/usr/bin/chromium
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/deck-worker/node_modules ./apps/deck-worker/node_modules
COPY --from=build /app/apps/deck-worker/dist ./apps/deck-worker/dist
COPY apps/deck-worker/package.json ./apps/deck-worker/package.json
CMD ["node", "apps/deck-worker/dist/server.js"]
