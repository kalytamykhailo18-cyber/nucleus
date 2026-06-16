# syntax=docker/dockerfile:1.7
#
# Build context: the repo root.
# Build command (from /home/ssm-user/project/nucleus):
#   sudo docker build -t nucleus-worker:local -f apps/worker/Dockerfile .

# 1. Dependencies — every workspace package.json copied so pnpm understands
#    the full graph, then we install only what @nucleus/worker needs.
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
    pnpm install --frozen-lockfile --filter "@nucleus/worker..."

# 2. Build stage — generate Prisma client from the schema in apps/web,
#    then compile TypeScript to dist/.
FROM node:20-alpine AS build
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /repo

COPY --from=deps /repo/node_modules ./node_modules
COPY --from=deps /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY package.json pnpm-workspace.yaml .npmrc pnpm-lock.yaml ./
COPY apps/web/prisma ./apps/web/prisma
COPY apps/worker ./apps/worker

# Prisma's auto-install probe gets confused when --schema points outside the
# package directory; mirror the schema into the worker so generation runs
# against a local path.
RUN mkdir -p /repo/apps/worker/prisma && cp /repo/apps/web/prisma/schema.prisma /repo/apps/worker/prisma/schema.prisma

WORKDIR /repo/apps/worker
RUN pnpm exec prisma generate --schema=./prisma/schema.prisma && pnpm exec tsc -p tsconfig.json

# 3. Runtime — minimal image, only the compiled JS and the production deps.
FROM node:20-alpine AS runtime
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -S nucleus && adduser -S nucleus -G nucleus

# Copy the compiled worker, its package.json (so node resolves @prisma/client
# off the workspace store), and the hoisted node_modules from the build stage.
COPY --from=build --chown=nucleus:nucleus /repo/node_modules ./node_modules
COPY --from=build --chown=nucleus:nucleus /repo/apps/worker/node_modules ./apps/worker/node_modules
COPY --from=build --chown=nucleus:nucleus /repo/apps/worker/dist ./apps/worker/dist
COPY --from=build --chown=nucleus:nucleus /repo/apps/worker/package.json ./apps/worker/package.json

USER nucleus

CMD ["node", "apps/worker/dist/index.js"]
