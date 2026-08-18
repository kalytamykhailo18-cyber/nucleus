import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireFamilyApiAuth } from '@/lib/admin';
import {
  GEOFENCE_DIRECTIONS,
  createGeofence,
  fetchUserGeofences,
} from '@/lib/geofences';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;
  const geofences = await fetchUserGeofences(userId);
  return NextResponse.json({ geofences });
}

const createSchema = z.object({
  deviceId: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  centerLat: z.number().min(-90).max(90),
  centerLng: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(20).max(50_000),
  direction: z.enum(GEOFENCE_DIRECTIONS).optional(),
});

export async function POST(request: NextRequest) {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 422 },
    );
  }

  const result = await createGeofence(userId, parsed.data);
  if (!result.ok) {
    if (result.reason === 'noDevice') {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'Zone limit reached', message: 'Eview pendants support up to 4 geocercas. Borra una para crear otra.' },
      { status: 409 },
    );
  }

  return NextResponse.json({ geofence: result.geofence }, { status: 201 });
}
