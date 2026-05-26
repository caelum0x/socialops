FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json ./
COPY apps/visual-worker/package.json apps/visual-worker/package.json
RUN corepack enable && pnpm install --filter @socialops/visual-worker... --frozen-lockfile

FROM deps AS build
COPY apps/visual-worker apps/visual-worker
RUN pnpm --filter @socialops/visual-worker build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/visual-worker/node_modules ./apps/visual-worker/node_modules
COPY --from=build /app/apps/visual-worker/dist ./apps/visual-worker/dist
COPY apps/visual-worker/package.json ./apps/visual-worker/package.json
COPY apps/visual-worker/workflows ./apps/visual-worker/workflows
CMD ["node", "apps/visual-worker/dist/server.js"]
