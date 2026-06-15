# syntax=docker/dockerfile:1

FROM node:20-alpine AS build

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY packages/schema/package.json packages/schema/

RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY packages/schema packages/schema
COPY docs/protocols docs/protocols

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @mmap/schema build \
  && pnpm --filter @mmap/web build

FROM nginx:1.27-alpine

RUN apk add --no-cache curl

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
