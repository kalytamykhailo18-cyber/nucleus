# @nucleus/web

The Sensu Nucleus Next.js 15 app — marketing site, inline Stripe checkout,
family dashboard, geofence editor, alert history, web-push subscriber, and
admin view. Single deploy at `https://app.sensu.com.mx`, served behind
CloudFront → nginx → Docker container.

## Local development

```bash
pnpm install
# database — uses the shared sensu Postgres on this VPS
pnpm --filter @nucleus/web exec prisma db push   # schema sync
pnpm --filter @nucleus/web dev                   # Next.js dev server
```

`apps/web` reads its config from `nucleus/.env` (gitignored, chmod 600).
`docker-compose.yml` mounts that file at boot via `env_file:`. The lazy
`lib/env.ts` getters throw if a required var is missing — fail fast,
never silently default.

## What's where

- `app/` — Next.js App Router. Server components by default; `'use client'`
  only for interactive surfaces (alerts feed, geofence editor, checkout
  form, push toggle).
- `app/api/` — every API route. `app/api/dev/*` are E2E-hook-secret-gated
  test seams; the rest are auth-gated.
- `lib/` — shared utilities (Prisma client, env, alerts, devices, geofences,
  Stripe SDK, parity comparator, password hashing, email transport).
- `components/` — reusable UI (header / footer / modal / confirm modal /
  device card / alerts feed / geofence editor / push toggle / etc.).
- `prisma/schema.prisma` — single source of truth. `prisma db push`
  applies it; we don't use migration files in Phase A.
- `public/sw.js` — web-push service worker.

## Deploy

Always via `scripts/redeploy.sh` from the repo root — never invoke
`playwright test` against a stale build. The script:

1. `pnpm install` — fast no-op when lockfile unchanged.
2. typecheck `@nucleus/web` and `@nucleus/worker`.
3. compile worker host-side (so the step-6 spec can spawn `node apps/worker/dist/index.js`).
4. `docker build` web + worker images.
5. `docker compose up -d` and wait for the container healthcheck.
6. seed the demo fixture against the live image (`scripts/seed-e2e.sh`).
7. run the full Playwright suite against `https://app.sensu.com.mx`.

Use `--skip-build` to rerun specs against the current image; use
`--grep "Step N"` to scope to one step's tests during iteration.

## Rollback

The compose file pins images by tag (`nucleus-web:local`,
`nucleus-worker:local`). To roll back to the previous image:

```bash
sudo docker tag nucleus-web:previous nucleus-web:local
sudo docker tag nucleus-worker:previous nucleus-worker:local
( cd /opt/sensu && sudo docker compose --env-file .env up -d nucleus-web nucleus-worker )
```

Schema changes are forward-only with `prisma db push`; if a step's schema
must be reverted, run `prisma db push` against an older `schema.prisma`
checked out from git. No migration history to rewind.

The Phase A risk profile is small: the EV-04 fleet keeps writing to the
same `EviewEvent` table whether nucleus-worker is up or not, because the
Python subscriber in `sensu-api` runs in parallel for the full 7-day
parity gate. Stopping `nucleus-web` only takes Nucleus down — pay.sensu.com.mx
and the mobile app keep working independently.
