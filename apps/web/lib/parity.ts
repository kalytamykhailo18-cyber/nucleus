import { prisma } from '@/lib/db';

/**
 * Tiny TTL memo for aggregate queries that move slowly relative to
 * page loads. /admin/parity is the only consumer; the summary +
 * Phase-A metric there used to recompute on every request, scanning
 * the 150k+ row WorkerParityCheck table each time. 5-minute TTL is
 * fine: TS observations keep landing, but the headline percentages +
 * counts shift by fractions of a percent within that window, and
 * Python stopped writing weeks ago so its count is frozen.
 */
function memoTTL<T>(
  ttlMs: number,
  fn: () => Promise<T>,
): (() => Promise<T>) & { bust: () => void } {
  let cached: { at: number; value: T } | null = null;
  let inflight: Promise<T> | null = null;
  const wrapped = async (): Promise<T> => {
    const now = Date.now();
    if (cached && now - cached.at < ttlMs) return cached.value;
    if (inflight) return inflight;
    inflight = fn()
      .then((v) => {
        cached = { at: Date.now(), value: v };
        return v;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };
  wrapped.bust = (): void => {
    cached = null;
    inflight = null;
  };
  return wrapped;
}

const FIVE_MIN_MS = 5 * 60 * 1000;

/**
 * Step 14 — parity comparator query helpers.
 *
 * Each MQTT event observed by either subscriber lands as a
 * WorkerParityCheck row, tagged source='TS' or source='PYTHON'. A pair
 * with the same (deviceId, eventType, timestamp ±1s) is considered the
 * same logical event; a row from one source without a matching row from
 * the other inside the parity window is a divergence.
 *
 * For the Phase A 7-day gate, both subscribers populate this table; the
 * Python writer needs the same shape under `source='PYTHON'` (small
 * sensu-api change). Until that lands, the comparator only sees TS
 * rows — divergence count is trivially equal to TS count.
 */

const PAIR_WINDOW_MS = 1_000;

/**
 * 7-day Phase-A parity gate start. Set to the moment both subscribers
 * began writing parity rows on every observation (post-revert of the
 * "skip parity on dedup" guard). Counts before this timestamp aren't
 * comparable: PYTHON wasn't writing yet, or wrote with mismatched
 * timestamps.
 */
const PHASE_A_PARITY_WINDOW_START_ISO = '2026-05-18T19:27:30Z';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;

export interface ParitySummary {
  totalObservations: number;
  tsCount: number;
  pythonCount: number;
  matchedCount: number;
  divergentCount: number;
  oldestObservation: string | null;
  newestObservation: string | null;
}

async function fetchParitySummaryUncached(
  windowFromIso?: string,
): Promise<ParitySummary> {
  const where = windowFromIso
    ? { observedAt: { gte: new Date(windowFromIso) } }
    : {};

  const [total, ts, python, divergent, agg] = await Promise.all([
    prisma.workerParityCheck.count({ where }),
    prisma.workerParityCheck.count({ where: { ...where, source: 'TS' } }),
    prisma.workerParityCheck.count({ where: { ...where, source: 'PYTHON' } }),
    prisma.workerParityCheck.count({ where: { ...where, divergent: true } }),
    prisma.workerParityCheck.aggregate({
      where,
      _min: { observedAt: true },
      _max: { observedAt: true },
    }),
  ]);

  // Pair count: events seen by BOTH sources within ±1s. Approximated by
  // the smaller of (TS, PYTHON) minus divergences — accurate when each
  // event is observed exactly once per source.
  const matched = Math.max(0, Math.min(ts, python) - divergent);

  return {
    totalObservations: total,
    tsCount: ts,
    pythonCount: python,
    matchedCount: matched,
    divergentCount: divergent,
    oldestObservation: agg._min.observedAt?.toISOString() ?? null,
    newestObservation: agg._max.observedAt?.toISOString() ?? null,
  };
}

const fetchParitySummaryCached = memoTTL(FIVE_MIN_MS, () =>
  fetchParitySummaryUncached(),
);

/**
 * 5-minute TTL on the all-time summary path. Callers that pass a
 * custom `windowFromIso` bypass the cache (specs / debug curls) since
 * different windows would collide on the same memo cell.
 */
export async function fetchParitySummary(
  windowFromIso?: string,
): Promise<ParitySummary> {
  if (windowFromIso) return fetchParitySummaryUncached(windowFromIso);
  return fetchParitySummaryCached();
}

export interface ParityRow {
  id: string;
  source: string;
  eviewDeviceId: string;
  eventType: string;
  timestamp: string;
  statusCode: number | null;
  batteryLevel: number | null;
  lat: number | null;
  lng: number | null;
  eviewEventId: string | null;
  divergent: boolean;
  observedAt: string;
}

export interface PaginatedParity {
  rows: ParityRow[];
  totalRows: number;
  totalPages: number;
  page: number;
  pageSize: number;
}

// 2026-06-30: fetchParityRecent ran 2 unconditional COUNT(*) against
// WorkerParityCheck on every page render. With 228k rows and parallel
// Playwright workers each hitting /admin/parity simultaneously, the
// counts serialized on the DB pool and pushed page render past the
// 30 s test timeout — the root cause of the three /admin/parity flake
// cluster. Counts only change when a new worker observation lands
// (rare in the demo DB), so caching for a minute eliminates the
// serialized hot path without hiding real divergence — the actual
// table rows below remain uncached so page=2 etc. still load fresh.
const PARITY_COUNT_TTL_MS = 60 * 1000;
const fetchParityCountsCached = memoTTL(
  PARITY_COUNT_TTL_MS,
  async (): Promise<{ tsCount: number; pyCount: number }> => {
    const [tsCount, pyCount] = await Promise.all([
      prisma.workerParityCheck.count({ where: { source: 'TS' } }),
      prisma.workerParityCheck.count({ where: { source: 'PYTHON' } }),
    ]);
    return { tsCount, pyCount };
  },
);

export async function fetchParityRecent(
  page = 1,
  pageSize = 20,
): Promise<PaginatedParity> {
  // Same "half from each source" intent as before — a pure newest-first
  // query would always be TS-only and hide the comparator's job. Each
  // page advances `half` rows in both streams, so page 1 = newest 10 TS
  // + newest 10 PY, page 2 = next 10 of each, etc.
  const half = Math.ceil(pageSize / 2);
  const { tsCount, pyCount } = await fetchParityCountsCached();
  const totalRows = tsCount + pyCount;
  const totalPages = Math.max(1, Math.ceil(Math.max(tsCount, pyCount) / half));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const skip = (safePage - 1) * half;
  const [tsRows, pyRows] = await Promise.all([
    prisma.workerParityCheck.findMany({
      where: { source: 'TS' },
      orderBy: { observedAt: 'desc' },
      take: half,
      skip,
    }),
    prisma.workerParityCheck.findMany({
      where: { source: 'PYTHON' },
      orderBy: { observedAt: 'desc' },
      take: half,
      skip,
    }),
  ]);
  const rows = [...tsRows, ...pyRows]
    .sort((a, b) => b.observedAt.getTime() - a.observedAt.getTime())
    .slice(0, pageSize)
    .map((r) => ({
    id: r.id,
    source: r.source,
    eviewDeviceId: r.eviewDeviceId,
    eventType: r.eventType,
    timestamp: r.timestamp.toISOString(),
    statusCode: r.statusCode,
    batteryLevel: r.batteryLevel,
    lat: r.lat,
    lng: r.lng,
    eviewEventId: r.eviewEventId,
    divergent: r.divergent,
    observedAt: r.observedAt.toISOString(),
  }));
  return { rows, totalRows, totalPages, page: safePage, pageSize };
}

export const __pairWindowMs = PAIR_WINDOW_MS;

/**
 * Phase-A 7-day acceptance metric.
 *
 * Scopes the match-pair computation to devices in `UserDevice` — those
 * are the only devices Python actually monitors (it loads its
 * monitored-set from `UserDevice` at startup). TS sees every message
 * on the LocTube broker, including unsold pendants and test rigs, so a
 * naive global TS-vs-PY join would always look divergent on rows
 * Python isn't watching.
 *
 * Returns the match rate plus a "days into the 7-day window" cursor
 * so the dashboard can show acceptance progress at a glance.
 */
export interface PhaseAParityMetric {
  windowStartIso: string;
  daysIntoWindow: number;
  tsObservations: number;
  matchedPairs: number;
  unmatchedTs: number;
  matchRatePct: number;
}

async function fetchPhaseAParityMetricUncached(): Promise<PhaseAParityMetric> {
  const start = new Date(PHASE_A_PARITY_WINDOW_START_ISO);
  const rows = await prisma.$queryRaw<
    { ts_total: bigint; matched: bigint }[]
  >`
    WITH ts_rows AS (
      SELECT w."eviewDeviceId", w."eventType", w.timestamp
      FROM "WorkerParityCheck" w
      WHERE w.source = 'TS'
        AND w."observedAt" >= ${start}
        AND EXISTS (
          SELECT 1 FROM "UserDevice" ud WHERE ud."eviewDeviceId" = w."eviewDeviceId"
        )
        -- Exclude synthetic E2E test devices. Python's monitored-set is
        -- loaded once at boot, so test devices created after that boot
        -- (STEP6UI-* / EV-E2E-* prefixes) are invisible to PYTHON-side
        -- writes by design. Treating them as "divergent" against TS
        -- would falsely pollute the production acceptance metric.
        AND w."eviewDeviceId" NOT LIKE 'STEP6%'
        AND w."eviewDeviceId" NOT LIKE 'EV-E2E-%'
        AND w."eviewDeviceId" NOT LIKE 'EV-DEMO-%'
    ),
    matched AS (
      SELECT t.* FROM ts_rows t
      WHERE EXISTS (
        SELECT 1 FROM "WorkerParityCheck" p
        WHERE p.source = 'PYTHON'
          AND p."eviewDeviceId" = t."eviewDeviceId"
          AND p."eventType" = t."eventType"
          AND p.timestamp BETWEEN t.timestamp - INTERVAL '1 second' AND t.timestamp + INTERVAL '1 second'
      )
    )
    SELECT
      (SELECT COUNT(*) FROM ts_rows)::bigint AS ts_total,
      (SELECT COUNT(*) FROM matched)::bigint AS matched
  `;
  const tsTotal = Number(rows[0]?.ts_total ?? 0n);
  const matched = Number(rows[0]?.matched ?? 0n);
  const elapsedMs = Math.max(0, Date.now() - start.getTime());
  const daysIntoWindow = Math.min(7, elapsedMs / (24 * 60 * 60 * 1_000));
  return {
    windowStartIso: start.toISOString(),
    daysIntoWindow,
    tsObservations: tsTotal,
    matchedPairs: matched,
    unmatchedTs: Math.max(0, tsTotal - matched),
    matchRatePct: tsTotal === 0 ? 100 : Math.round((1000 * matched) / tsTotal) / 10,
  };
}

/**
 * Phase-A metric is wrapped in the same 5-minute TTL as the summary.
 * The CTE used to scan 150k+ rows on every /admin/parity load; with
 * the new observedAt index plus this memo it's effectively a one-shot
 * read.
 */
export const fetchPhaseAParityMetric = memoTTL(
  FIVE_MIN_MS,
  fetchPhaseAParityMetricUncached,
);

/**
 * Hand-bust the parity aggregate cache. Call this from any route that
 * writes a WorkerParityCheck row (e.g. `/api/dev/parity-mirror`) so
 * that a fresh GET reflects the new row immediately, instead of being
 * stuck at the cached numbers for up to 5 minutes. Production worker
 * writes happen in a separate process and cannot reach this memo —
 * those still wait out the TTL, which is fine since the percentages
 * shift by fractions of a percent between web-process page loads.
 */
export function bustParityCache(): void {
  fetchParitySummaryCached.bust();
  fetchPhaseAParityMetric.bust();
}

export const __sevenDaysMs = SEVEN_DAYS_MS;
