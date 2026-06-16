# syntax=docker/dockerfile:1.7
#
# Build context: the repo root.
# Build command (from /home/ssm-user/project/nucleus):
#   sudo docker build -t nucleus-web:local -f apps/web/Dockerfile .

# 1. Dependencies — every workspace package.json copied so pnpm understands
#    the full graph, then we install only what @nucleus/web needs.
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl openssl-dev
RUN corepack enable
WORKDIR /repo

COPY package.json pnpm-workspace.yaml .npmrc ./
COPY pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/auth/package.json ./packages/auth/package.json
COPY packages/eview/package.json ./packages/eview/package.json

RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --filter "@nucleus/web..."

# 2. Build stage — generate Prisma client, then build the Next.js standalone bundle.
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/web/node_modules ./apps/web/node_modules
COPY package.json pnpm-workspace.yaml .npmrc pnpm-lock.yaml ./
COPY apps/web ./apps/web

WORKDIR /repo/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
# Cap the build's V8 heap so a runaway TypeScript/webpack worker cannot
# eat all the RAM on the 4 GB host (2026-06-12 + 2026-06-15 outages
# were both build-time OOM events on the prod box).
ENV NODE_OPTIONS=--max-old-space-size=1536
RUN pnpm exec prisma generate
RUN pnpm build

# 3. Runtime — Next.js standalone output, minimal image.
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl wget
WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

RUN addgroup -S nucleus && adduser -S nucleus -G nucleus

COPY --from=build --chown=nucleus:nucleus /repo/apps/web/.next/standalone ./
COPY --from=build --chown=nucleus:nucleus /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nucleus:nucleus /repo/apps/web/public ./apps/web/public

USER nucleus
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD wget -qO- http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "apps/web/server.js"]
