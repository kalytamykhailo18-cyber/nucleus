import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { requireFamilyApiAuth } from '@/lib/admin';
import { env } from '@/lib/env';

/**
 * Self-hosted profile-avatar upload.
 *
 * Client posts a multipart form with `file`. The server writes it to
 * NUCLEUS_UPLOADS_DIR/avatars/u_<userId>_<ts>_<rand>.<ext> and returns
 * the public URL. The profile form persists that URL via PATCH
 * /api/auth/me.
 *
 * Replaces the prior Cloudinary signed upload (retired 2026-06-26 with
 * the rest of the dead `dcfjvxt5h` cloud). nginx serves the directory
 * at NUCLEUS_UPLOADS_PUBLIC_BASE with long-cache headers; the random
 * suffix in the filename invalidates the previous avatar without a
 * cache-bust query string.
 */
export const dynamic = 'force-dynamic';

const MAX_BYTES = 8 * 1024 * 1024;
const SUBDIR = 'avatars';

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireFamilyApiAuth();
  if (!gate.ok) return NextResponse.json(gate.body, { status: gate.status });
  const userId = gate.userId;

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
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: 'Must be an image' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Image too large (max ${Math.round(MAX_BYTES / 1024 / 1024)} MB)` },
      { status: 413 },
    );
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const rand = randomUUID().slice(0, 8);
  const filename = `u_${userId}_${timestamp}_${rand}.${ext}`;

  const targetDir = path.join(env.NUCLEUS_UPLOADS_DIR, SUBDIR);
  await mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(targetPath, buffer);

  const publicUrl = `${env.NUCLEUS_UPLOADS_PUBLIC_BASE}/${SUBDIR}/${filename}`;
  return NextResponse.json({ url: publicUrl });
}
