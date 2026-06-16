import crypto from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { env } from '@/lib/env';

/**
 * Signed Cloudinary upload for landing-page images (Step 15).
 *
 * Admins post a multipart form with `file` from the EditableImage
 * widget. The server signs with the CLOUDINARY_API_SECRET (kept off
 * the browser) and forwards to Cloudinary's REST endpoint, returning
 * the `secure_url`. The EditableImage component then PATCHes
 * /api/admin/landing/[slug] with the URL.
 *
 * Mirrors the profile-avatar upload shape — different folder + tag.
 */
export const dynamic = 'force-dynamic';

const MAX_BYTES = 12 * 1024 * 1024;
const FOLDER = 'sensu/landing';

function signParams(params: Record<string, string>, apiSecret: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + apiSecret).digest('hex');
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  await requireAdmin();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: 'invalid_form' }, { status: 400 });
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'missing_file' }, { status: 400 });
  }
  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'not_an_image' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'too_large', limitBytes: MAX_BYTES },
      { status: 413 },
    );
  }
  const slugRaw = String(form.get('slug') ?? 'unknown');
  const slug = /^[a-z0-9-]+$/.test(slugRaw) ? slugRaw : 'unknown';

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params: Record<string, string> = {
    folder: FOLDER,
    timestamp,
    public_id: `${slug}_${timestamp}`,
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
      { error: 'cloudinary_upload_failed', detail: text.slice(0, 500) },
      { status: 502 },
    );
  }
  const body = (await res.json()) as { secure_url?: string };
  if (!body.secure_url) {
    return NextResponse.json(
      { error: 'cloudinary_no_url' },
      { status: 502 },
    );
  }
  return NextResponse.json({ url: body.secure_url });
}
