/**
 * One-shot marketing-asset capture. Boots Playwright against the live
 * site using the already-seeded `.auth/demo.json` and `.auth/admin.json`
 * storage states, takes a handful of branded product screenshots of
 * actual Nucleus surfaces, and writes them into the nginx-served
 * `/opt/sensu/uploads/landing/` mount so the home-page cards have
 * real visuals again.
 *
 * The Cloudinary cloud `dcfjvxt5h` was disabled on 2026-06-26, killing
 * the 5 "Qué es Sensu" cards + 2 SOS cards. We cannot recover the
 * originals (they were Lovable.dev-hosted), but cards 2/3/4 and the
 * sos-app card represent actual Nucleus surfaces we own — so we
 * screenshot them instead of waiting on stock photos.
 *
 * Run from the repo root:
 *   node scripts/capture-marketing-shots.mjs
 *
 * Output lands at /opt/sensu/uploads/landing/<slug>.png owned by 100:101
 * so nginx + nucleus-web both have access. Use the existing chromium
 * shipped inside apps/web/node_modules/playwright (so this script does
 * not need its own browser install).
 */
import playwrightPkg from '/home/ssm-user/project/nucleus/node_modules/.pnpm/playwright@1.49.0/node_modules/playwright/index.js';
const { chromium } = playwrightPkg;
import path from 'node:path';
import { existsSync, statSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');

const BASE_URL = 'https://app.sensu.com.mx';
const AUTH_DIR = path.join(REPO_ROOT, 'tests', 'e2e', '.auth');
const OUT_DIR = '/opt/sensu/uploads/landing';

const CARD_VIEWPORT = { width: 1600, height: 1200 };
const VIDEO_VIEWPORT = { width: 1600, height: 900 };

// Admin views (operator board, etc.) deliberately omitted — the
// classifier (rightly) flagged publishing live admin screenshots as
// a PII risk. Only the demo account's surfaces (seeded synthetic
// data Juan already uses for client demos) ship to the marketing
// site here. Cards 1 / 2 / 5 / sos-device stay empty pending real
// brand photography from Juan.
const SHOTS = [
  {
    slug: 'what-is-card-3-image',
    role: 'demo',
    url: '/dashboard',
    viewport: CARD_VIEWPORT,
    setupMs: 6000,
    description: 'Panel familiar — dashboard with map + device cards',
  },
  {
    slug: 'what-is-card-4-image',
    role: 'demo',
    url: '/dashboard',
    viewport: CARD_VIEWPORT,
    setupMs: 6000,
    description: 'Detección de caídas — scroll to alerts feed for a distinct composition',
    afterLoad: async (page) => {
      // Scroll the alerts feed into view so card 4 shows the SOS /
      // fall-detection feed prominently instead of duplicating the
      // hero+map composition card 3 uses.
      try {
        await page.locator('[data-testid="dashboard-alerts"]').scrollIntoViewIfNeeded({ timeout: 4000 });
        await page.waitForTimeout(1200);
      } catch {
        // Fall back to the default surface if the alerts section is missing.
      }
    },
  },
  {
    slug: 'sos-app-image',
    role: 'demo',
    url: '/dashboard',
    viewport: VIDEO_VIEWPORT,
    setupMs: 6000,
    description: 'SOS desde la app — panel familiar view (16:9 crop)',
  },
];

async function main() {
  if (!existsSync(OUT_DIR)) {
    throw new Error(`Output dir missing: ${OUT_DIR}`);
  }
  const stat = statSync(OUT_DIR);
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
      console.log(`[capture] ${shot.slug} :: ${shot.role} → ${shot.url}`);
      try {
        await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 30_000 });
      } catch (err) {
        console.warn(`[capture] networkidle timed out, continuing: ${err.message}`);
      }
      await page.waitForTimeout(shot.setupMs);
      if (shot.afterLoad) {
        await shot.afterLoad(page);
      }
      const tmp = path.join('/tmp', `${shot.slug}.jpg`);
      await page.screenshot({
        path: tmp,
        animations: 'disabled',
        fullPage: false,
        type: 'jpeg',
        quality: 82,
      });
      await ctx.close();
      const dest = path.join(OUT_DIR, `${shot.slug}.jpg`);
      execSync(`sudo mv ${tmp} ${dest} && sudo chown 100:101 ${dest}`);
      console.log(`[capture] wrote ${dest}`);
    }
  } finally {
    await browser.close();
  }

  console.log('[capture] done.');
}

main().catch((err) => {
  console.error('[capture] failed:', err);
  process.exit(1);
});
