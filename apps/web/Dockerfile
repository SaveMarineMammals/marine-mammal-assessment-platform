# syntax=docker/dockerfile:1

# Single static site image: mission web at / + field PWA at /field/app/
FROM node:20-alpine AS build

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/field/package.json apps/field/
COPY packages/schema/package.json packages/schema/
COPY packages/geo-time/package.json packages/geo-time/
COPY packages/brand/package.json packages/brand/

RUN pnpm install --frozen-lockfile

COPY apps/web apps/web
COPY apps/field apps/field
COPY packages/schema packages/schema
COPY packages/geo-time packages/geo-time
COPY packages/brand packages/brand
COPY docs/protocols docs/protocols

RUN pnpm install --frozen-lockfile

ARG VITE_DOCS_URL=/docs/manatee-v1
ARG MMAP_BUILD_SHA=nogit
ENV VITE_DOCS_URL=$VITE_DOCS_URL
ENV MMAP_BUILD_SHA=$MMAP_BUILD_SHA

RUN pnpm --filter @mmap/schema build \
  && pnpm --filter @mmap/geo-time build \
  && pnpm --filter @mmap/brand build \
  && pnpm --filter @mmap/web build \
  && pnpm --filter @mmap/field build

FROM nginx:1.27-alpine

RUN apk add --no-cache curl

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY --from=build /app/apps/field/dist /usr/share/nginx/html/field/app

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/ && curl -f http://localhost/field/app/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
