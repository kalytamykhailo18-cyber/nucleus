import {
  LuTrendingUp,
  LuUsers,
  LuFilter,
  LuTags,
  LuChartPie,
  LuActivity,
  LuRadio,
  LuTriangleAlert,
} from 'react-icons/lu';
import { requireAdmin } from '@/lib/admin';
import { SectionLabel } from '@/components/section-label';
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
import { BusinessDashboardClient } from './business-client';
import { ChurnCard } from './churn-card';
import { DropOffCard } from './drop-off-card';
import { FunnelCard } from './funnel-card';
import { InventoryAgeCard } from './inventory-age-card';
import { LocTubeHealthCard } from './loctube-health-card';
import { MrrCard } from './mrr-card';
import { PromoCard } from './promo-card';
import { SalesMixCard } from './sales-mix-card';

/**
 * /admin/business — the business dashboard (2026-07-11).
 *
 * A single-page summary of every metric Juan needs to run Sensu at a
 * glance: MRR trend, active vs churned, funnel conversion, promo
 * performance, sales mix, device inventory age, LocTube health, and
 * top drop-off points. Every chart pulls from live tables via
 * lib/admin-business.ts; every card is memory-rule-clean (react-icons/lu
 * only, semantic colors, sensu-500 brand accent, no animated
 * gradients).
 *
 * Charts land one by one under sequential E2E gating.
 */
export const dynamic = 'force-dynamic';

export default async function BusinessDashboardPage() {
  await requireAdmin();

  const [
    mrr,
    churn,
    funnel,
    promo,
    salesMix,
    inventoryAge,
    locTubeHealth,
    dropOff,
  ] = await Promise.all([
    fetchMrrSeries(),
    fetchChurnSnapshot(),
    fetchFunnel(),
    fetchPromoPerformance(),
    fetchSalesMix(),
    fetchInventoryAge(),
    fetchLocTubeHealth(),
    fetchDropOff(),
  ]);

  const cards: Array<{
    slug: string;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    span: 'full' | 'half';
    body: React.ReactNode;
  }> = [
    {
      slug: 'mrr',
      title: 'Ingreso mensual recurrente',
      subtitle: 'MRR de los últimos 12 meses',
      icon: <LuTrendingUp aria-hidden className="h-4 w-4 text-sensu-500" />,
      span: 'full',
      body: <MrrCard payload={mrr} />,
    },
    {
      slug: 'active-churned',
      title: 'Activos vs cancelados',
      subtitle: 'Este mes',
      icon: <LuUsers aria-hidden className="h-4 w-4 text-emerald-500" />,
      span: 'half',
      body: <ChurnCard payload={churn} />,
    },
    {
      slug: 'sales-mix',
      title: 'Origen de las ventas',
      subtitle: 'Venta asistida vs autoservicio',
      icon: <LuChartPie aria-hidden className="h-4 w-4 text-sensu-500" />,
      span: 'half',
      body: <SalesMixCard payload={salesMix} />,
    },
    {
      slug: 'funnel',
      title: 'Embudo de conversión',
      subtitle: 'De checkout a servicio activo',
      icon: <LuFilter aria-hidden className="h-4 w-4 text-sensu-500" />,
      span: 'full',
      body: <FunnelCard payload={funnel} />,
    },
    {
      slug: 'promo',
      title: 'Códigos promocionales',
      subtitle: 'Redenciones e ingresos generados',
      icon: <LuTags aria-hidden className="h-4 w-4 text-sensu-500" />,
      span: 'full',
      body: <PromoCard payload={promo} />,
    },
    {
      slug: 'inventory-age',
      title: 'Antigüedad de la flota',
      subtitle: 'Última señal por dispositivo',
      icon: <LuActivity aria-hidden className="h-4 w-4 text-emerald-500" />,
      span: 'half',
      body: <InventoryAgeCard payload={inventoryAge} />,
    },
    {
      slug: 'loctube-health',
      title: 'Salud de LocTube',
      subtitle: 'Dispositivos con señal en las últimas 24 h',
      icon: <LuRadio aria-hidden className="h-4 w-4 text-emerald-500" />,
      span: 'half',
      body: <LocTubeHealthCard payload={locTubeHealth} />,
    },
    {
      slug: 'drop-off',
      title: 'Puntos de abandono',
      subtitle: 'Dónde se pierden más clientes',
      icon: <LuTriangleAlert aria-hidden className="h-4 w-4 text-amber-500" />,
      span: 'full',
      body: <DropOffCard payload={dropOff} />,
    },
  ];

  return (
    <main
      data-testid="business-dashboard"
      className="mx-auto w-full max-w-6xl px-6 py-10"
    >
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <SectionLabel icon={LuTrendingUp}>Panel de negocio</SectionLabel>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            Sensu · Panel de negocio
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600">
            Los números que importan para operar Sensu, en una sola
            vista. Datos en vivo desde la base de datos, actualizados
            cada cinco minutos.
          </p>
        </div>
      </div>

      <BusinessDashboardClient cards={cards} />
    </main>
  );
}
