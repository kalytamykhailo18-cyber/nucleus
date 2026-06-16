import { LuRadio } from 'react-icons/lu';
import { SectionLabel } from '@/components/section-label';
import { requireAdmin } from '@/lib/admin';
import { env } from '@/lib/env';
import { fetchOperatorBoard } from '@/lib/operator-board';
import { fetchOperatorPresence } from '@/lib/operator-presence';
import { fetchOperatorMapAlerts } from '@/lib/operator-map';
import { OperatorBoardClient } from './operator-board-client';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

export default async function AdminOperatorPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<React.ReactElement> {
  await requireAdmin();
  const params = await searchParams;
  const pageNumber = (() => {
    const n = Number(params.page);
    return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
  })();
  const [board, presence, mapAlerts] = await Promise.all([
    fetchOperatorBoard(pageNumber, PAGE_SIZE),
    fetchOperatorPresence(),
    fetchOperatorMapAlerts(),
  ]);
  const auraCallNumber = env.AURA_CALL_CENTER_NUMBER;

  return (
    <main
      data-testid="admin-operator-page"
      className="flex flex-1 flex-col items-center px-6 pt-12 pb-12"
    >
      <div className="w-full max-w-5xl">
        <SectionLabel icon={LuRadio} tone="sensu">
          Administración · Operador
        </SectionLabel>
        <h1 className="mt-2 text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900">
          Cola del operador
        </h1>
        <p className="mt-3 text-base text-zinc-500">
          Cada alerta del último periodo, ordenada por gravedad y recencia.
          Toca una fila para ver el resumen del titular, el número del adulto
          mayor y los contactos de emergencia que el call-center debe llamar.
        </p>

        <OperatorBoardClient
          initialAlerts={board.alerts}
          initialPresence={presence}
          initialMapAlerts={mapAlerts}
          auraCallNumber={auraCallNumber}
          pagination={{
            currentPage: board.page,
            totalPages: board.totalPages,
            totalRows: board.totalRows,
            pageSize: board.pageSize,
            baseHref: '/admin/operator',
          }}
        />
      </div>
    </main>
  );
}
