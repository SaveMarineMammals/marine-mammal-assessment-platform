# syntax=docker/dockerfile:1

FROM node:20-alpine

RUN corepack enable && apk add --no-cache curl

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY packages/schema/package.json packages/schema/
COPY packages/geo-time/package.json packages/geo-time/

RUN pnpm install --frozen-lockfile

COPY apps/api/migrations apps/api/migrations
COPY apps/api apps/api
COPY packages/schema packages/schema
COPY packages/geo-time packages/geo-time

# Source copy replaces workspace dirs and drops per-package node_modules links.
RUN pnpm install --frozen-lockfile

RUN pnpm --filter @mmap/schema build \
  && pnpm --filter @mmap/geo-time build \
  && pnpm --filter @mmap/api build

ENV NODE_ENV=production
ENV PORT=3001
ENV HOST=0.0.0.0

EXPOSE 3001

HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3001/v1/health || exit 1

CMD ["node", "apps/api/dist/index.js"]
