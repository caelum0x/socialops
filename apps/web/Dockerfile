FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN corepack enable && pnpm install --prod=false

FROM deps AS build
COPY . .
RUN pnpm build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
