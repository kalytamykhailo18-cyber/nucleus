/**
 * One-shot marketing-asset capture. Boots Playwright against the live
 * site using the already-seeded `.auth/demo.json` and `.auth/admin.json`
 * storage states, takes a handful of branded product screenshots of
 * actual Nucleus surfaces, and writes them straight into the nginx-
 * served `/opt/sensu/uploads/landing/` mount so the home-page cards
 * have real visuals again.
 *
 * Why this exists: the Cloudinary cloud `dcfjvxt5h` was disabled on
 * 2026-06-26, killing the 5 "Qué es Sensu" cards + 2 SOS cards. We
 * cannot recover the originals (they were Lovable.dev-hosted), but
 * the cards 2/3/4 and the sos-app card represent actual Nucleus
 * surfaces we own — so we screenshot them instead of waiting on
 * stock photos.
 *
 * Run: `pnpm tsx scripts/capture-marketing-shots.ts`
 * Output: /opt/sensu/uploads/landing/<slug>.png  (owned by 100:101 so
 *         nginx + nucleus-web both have access)
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';

const BASE_URL = 'https://app.sensu.com.mx';
const AUTH_DIR = path.resolve(__dirname, '..', 'tests', 'e2e', '.auth');
const OUT_DIR = '/opt/sensu/uploads/landing';

// 4:3 aspect ratio matches the `aspect-[4/3]` Tailwind utility on the
// home-page card images. 1600×1200 oversamples for crisp Retina render.
const CARD_VIEWPORT = { width: 1600, height: 1200 } as const;
// 16:9 for the SOS-app card (renders inside an aspect-video container).
const VIDEO_VIEWPORT = { width: 1600, height: 900 } as const;

interface Shot {
  slug: string;          // LandingItem slug; output filename matches
  role: 'demo' | 'admin';
  url: string;           // relative to BASE_URL
  viewport: { width: number; height: number };
  setupMs: number;       // extra wait after navigation for animations / map load
  description: string;
}

const SHOTS: Shot[] = [
  {
    slug: 'what-is-card-2-image',
    role: 'admin',
    url: '/admin/operator',
    viewport: CARD_VIEWPORT,
    setupMs: 4000, // give the alert feed time to render
    description: 'Call Center 24/7 — operator board with live alerts',
  },
  {
    slug: 'what-is-card-3-image',
    role: 'demo',
    url: '/dashboard',
    viewport: CARD_VIEWPORT,
    setupMs: 5000, // MapLibre needs a beat to load tiles + plot pins
    description: 'Panel familiar — dashboard with map + device cards',
  },
  {
    slug: 'what-is-card-4-image',
    role: 'demo',
    url: '/dashboard',
    viewport: CARD_VIEWPORT,
    setupMs: 5000,
    description: 'Detección de caídas — dashboard with alert feed',
  },
  {
    slug: 'sos-app-image',
    role: 'demo',
    url: '/dashboard',
    viewport: VIDEO_VIEWPORT,
    setupMs: 5000,
    description: 'SOS desde la app — panel familiar view',
  },
];

async function main(): Promise<void> {
  if (!existsSync(OUT_DIR)) {
    throw new Error(`Output dir missing: ${OUT_DIR}`);
  }
  const stat = statSync(OUT_DIR);
  // eslint-disable-next-line no-console
  console.log(`[capture] target ${OUT_DIR} (uid=${stat.uid} gid=${stat.gid})`);

  const browser = await chromium.launch();
  try {
    for (const shot of SHOTS) {
      const storageState = path.join(AUTH_DIR, `${shot.role}.json`);
      if (!existsSync(storageState)) {
        throw new Error(
          `Missing storage state ${storageState}; run scripts/redeploy.sh once so global-setup writes it.`,
        );
      }
      const ctx = await browser.newContext({
        baseURL: BASE_URL,
        viewport: shot.viewport,
        deviceScaleFactor: 2,
        storageState,
      });
      const page = await ctx.newPage();
      // eslint-disable-next-line no-console
      console.log(`[capture] ${shot.slug} :: ${shot.role} → ${shot.url}`);
      await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 30_000 });
      await page.waitForTimeout(shot.setupMs);
      const tmp = path.join('/tmp', `${shot.slug}.png`);
      await page.screenshot({
        path: tmp,
        animations: 'disabled',
        fullPage: false,
      });
      await ctx.close();
      // Move into /opt/sensu/uploads/landing via sudo so the owner
      // stays 100:101 (the nucleus container uid) and nginx can read it.
      const dest = path.join(OUT_DIR, `${shot.slug}.png`);
      execSync(`sudo mv ${tmp} ${dest} && sudo chown 100:101 ${dest}`);
      // eslint-disable-next-line no-console
      console.log(`[capture] wrote ${dest}`);
    }
  } finally {
    await browser.close();
  }

  // eslint-disable-next-line no-console
  console.log('[capture] done.');
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[capture] failed:', err);
  process.exit(1);
});
