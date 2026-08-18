import { randomUUID } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { env } from '@/lib/env';

/**
 * Self-hosted upload for landing-page images.
 *
 * Admin posts a multipart form with `file` from the EditableImage
 * widget. The file is written to NUCLEUS_UPLOADS_DIR/landing/<slug>_<ts>_<rand>.<ext>
 * and the public URL is returned. The EditableImage component then
 * PATCHes /api/admin/landing/[slug] with the URL so the LandingItem
 * row stores it.
 *
 * Replaces the Cloudinary signed-upload flow (retired 2026-06-26
 * when the upstream account `dcfjvxt5h` was disabled). The mount lives
 * on the EC2 disk so the marketing surface no longer depends on a
 * third-party CDN that can suspend the account without warning.
 *
 * nginx exposes NUCLEUS_UPLOADS_DIR at NUCLEUS_UPLOADS_PUBLIC_BASE
 * with long-cache headers; the random suffix in the filename means a
 * re-upload always invalidates without a cache-bust query string.
 */
export const dynamic = 'force-dynamic';

const MAX_BYTES = 12 * 1024 * 1024;
const SUBDIR = 'landing';

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

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
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
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
  const rand = randomUUID().slice(0, 8);
  const filename = `${slug}_${timestamp}_${rand}.${ext}`;

  const targetDir = path.join(env.NUCLEUS_UPLOADS_DIR, SUBDIR);
  await mkdir(targetDir, { recursive: true });
  const targetPath = path.join(targetDir, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(targetPath, buffer);

  const publicUrl = `${env.NUCLEUS_UPLOADS_PUBLIC_BASE}/${SUBDIR}/${filename}`;
  return NextResponse.json({ url: publicUrl });
}
