FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/video-worker/package.json apps/video-worker/package.json
RUN corepack enable && pnpm install --filter @socialops/video-worker... --frozen-lockfile

FROM deps AS build
COPY apps/video-worker apps/video-worker
RUN pnpm --filter @socialops/video-worker build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/video-worker/node_modules ./apps/video-worker/node_modules
COPY --from=build /app/apps/video-worker/dist ./apps/video-worker/dist
COPY apps/video-worker/package.json ./apps/video-worker/package.json
CMD ["node", "apps/video-worker/dist/server.js"]
