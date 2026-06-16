import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/auth';
import { env } from '@/lib/env';

/**
 * Signed Cloudinary upload for profile avatars.
 *
 * Client posts a multipart form with `file`. Server signs the upload
 * with the CLOUDINARY_API_SECRET, forwards the file to Cloudinary's
 * REST endpoint, and returns the secure_url. The profile form persists
 * that URL via PATCH /api/auth/me.
 *
 * Why server-side: keeps the api_secret server-side (never in the
 * browser), and lets us cap upload size, mime type, and folder per
 * route. We do not use the cloudinary SDK — a single signed fetch
 * keeps the dependency tree minimal.
 */
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MB hard cap; Cloudinary delivers downsized versions
const FOLDER = 'sensu/avatars';

function signParams(params: Record<string, string>, apiSecret: string): string {
  // Cloudinary signature: SHA1 of `key1=v1&key2=v2{api_secret}` with
  // keys sorted alphabetically and api_secret appended (no separator).
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid form' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Must be an image' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)` },
      { status: 413 },
    );
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  // Tag the asset with the userId so future cleanup / audit can find
  // every avatar a given account ever uploaded.
  const params: Record<string, string> = {
    folder: FOLDER,
    timestamp,
    public_id: `u_${userId}_${timestamp}`,
  };
  const signature = signParams(params, env.CLOUDINARY_API_SECRET);

  const upload = new FormData();
  upload.set('file', file);
  upload.set('api_key', env.CLOUDINARY_API_KEY);
  upload.set('timestamp', timestamp);
  upload.set('signature', signature);
  for (const [k, v] of Object.entries(params)) {
    if (k !== 'timestamp') upload.set(k, v);
  }

  const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`;
  const res = await fetch(cloudinaryUrl, { method: 'POST', body: upload });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json(
      { error: 'Cloudinary upload failed', detail: text.slice(0, 500) },
      { status: 502 },
    );
  }
  const body = (await res.json()) as { secure_url?: string };
  if (!body.secure_url) {
    return NextResponse.json(
      { error: 'Cloudinary returned no URL' },
      { status: 502 },
    );
  }
  return NextResponse.json({ url: body.secure_url });
}
