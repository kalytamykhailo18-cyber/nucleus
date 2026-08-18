import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import {
  fetchChurnSnapshot,
  fetchDropOff,
  fetchFunnel,
  fetchInventoryAge,
  fetchLocTubeHealth,
  fetchMrrSeries,
  fetchPromoPerformance,
  fetchSalesMix,
} from '@/lib/admin-business';

/**
 * CSV export for /admin/business cards (2026-07-11).
 *
 * Query: `?chart=<slug>` — one of the eight known card slugs. Returns
 * text/csv with a filename tailored per chart. Admin-gated the same way
 * the parent page is.
 */
export const dynamic = 'force-dynamic';

const ALLOWED_CHARTS = [
  'mrr',
  'active-churned',
  'sales-mix',
  'funnel',
  'promo',
  'inventory-age',
  'loctube-health',
  'drop-off',
] as const;

type Chart = (typeof ALLOWED_CHARTS)[number];

function csvEscape(v: string | number): string {
  const s = String(v);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function toCsv(rows: Array<Array<string | number>>): string {
  return rows.map((r) => r.map(csvEscape).join(',')).join('\n') + '\n';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  await requireAdmin();

  const chart = request.nextUrl.searchParams.get('chart') as Chart | null;
  if (!chart || !ALLOWED_CHARTS.includes(chart)) {
    return NextResponse.json({ error: 'invalid_chart' }, { status: 400 });
  }

  let csv = '';
  switch (chart) {
    case 'mrr': {
      const p = await fetchMrrSeries();
      csv = toCsv([
        ['month_start', 'mrr_mxn'],
        ...p.series.map((r) => [r.monthStart, r.mrrMxn]),
      ]);
      break;
    }
    case 'active-churned': {
      const p = await fetchChurnSnapshot();
      csv = toCsv([
        ['metric', 'value'],
        ['active', p.active],
        ['churned_this_month', p.churnedThisMonth],
        ['net_change', p.netChange],
        ['churn_rate_pct', p.churnRatePct.toFixed(2)],
      ]);
      break;
    }
    case 'sales-mix': {
      const p = await fetchSalesMix();
      csv = toCsv([
        ['bucket', 'label', 'user_count', 'subscription_count', 'revenue_mxn'],
        ...p.slices.map((s) => [
          s.bucket,
          s.label,
          s.userCount,
          s.subscriptionCount,
          s.revenueMxn,
        ]),
      ]);
      break;
    }
    case 'funnel': {
      const p = await fetchFunnel();
      csv = toCsv([
        ['stage', 'label', 'count', 'pct_of_start', 'pct_of_prev'],
        ...p.stages.map((s) => [
          s.slug,
          s.label,
          s.count,
          s.pctOfStart.toFixed(2),
          s.pctOfPrev.toFixed(2),
        ]),
      ]);
      break;
    }
    case 'promo': {
      const p = await fetchPromoPerformance();
      csv = toCsv([
        [
          'code',
          'label',
          'channel',
          'redemptions',
          'mxn_discounted',
          'gross_revenue_mxn',
          'net_revenue_mxn',
        ],
        ...p.rows.map((r) => [
          r.code,
          r.label,
          r.channel,
          r.redemptions,
          r.mxnDiscounted,
          r.grossRevenue,
          r.netRevenue,
        ]),
      ]);
      break;
    }
    case 'inventory-age': {
      const p = await fetchInventoryAge();
      csv = toCsv([
        ['bucket', 'label', 'device_count'],
        ...p.buckets.map((b) => [b.bucket, b.label, b.n]),
      ]);
      break;
    }
    case 'loctube-health': {
      const p = await fetchLocTubeHealth();
      csv = toCsv([
        ['metric', 'value'],
        ['total_devices', p.totalDevices],
        ['active_last_24h', p.activeLast24h],
        ['pct_healthy', p.pctHealthy.toFixed(2)],
        ['tone', p.tone],
      ]);
      break;
    }
    case 'drop-off': {
      const p = await fetchDropOff();
      csv = toCsv([
        ['step', 'label', 'count'],
        ...p.steps.map((s) => [s.slug, s.label, s.count]),
      ]);
      break;
    }
  }

  const filename = `sensu-business-${chart}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
