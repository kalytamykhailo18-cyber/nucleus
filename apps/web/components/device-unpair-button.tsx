'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LuTrash2 } from 'react-icons/lu';
import { ConfirmModal } from './confirm-modal';

/**
 * Customer-side unpair button on each /dashboard device card.
 *
 * Removes the UserDevice row that links the signed-in user to the
 * device. The Device row itself stays in place (other users or the
 * admin fleet inventory may reference it). After a successful
 * unpair the dashboard refreshes so the card disappears.
 *
 * Juan asked for this 2026-06-16 — he wanted to drop the seeded
 * demo devices and keep only his real EV-12 pendant on his panel.
 */
export function DeviceUnpairButton({
  deviceId,
  label,
}: {
  deviceId: string;
  label: string;
}): React.ReactElement {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleConfirm(): Promise<void> {
    setBusy(true);
    try {
      const res = await fetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        setBusy(false);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid={`device-${deviceId}-unpair`}
        aria-label={`Quitar ${label} de tu panel`}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-rose-600 transition-colors hover:bg-rose-50 cursor-pointer"
      >
        <LuTrash2 aria-hidden className="h-4 w-4" />
      </button>
      <ConfirmModal
        open={open}
        title={`Quitar «${label}» de tu panel`}
        body="El dispositivo deja de aparecer en tu panel. Si fue un error, contacta al call center para volverlo a vincular."
        confirmLabel="Quitar"
        busyLabel="Quitando…"
        busy={busy}
        onConfirm={() => void handleConfirm()}
        onCancel={() => setOpen(false)}
        testId={`device-${deviceId}-unpair-modal`}
      />
    </>
  );
}
