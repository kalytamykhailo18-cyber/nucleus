// One-shot uploader: push the harvested Lovable assets into Cloudinary
// so Nucleus's landing page can reference them after the DNS cutover.
//
// Run from /home/ssm-user/project/nucleus with .env sourced:
//   set -a; source .env; set +a
//   node scripts/upload-lovable-assets.mjs
import crypto from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';

const cloud = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;
if (!cloud || !apiKey || !apiSecret) {
  console.error('missing CLOUDINARY_* env vars');
  process.exit(1);
}

const SRC = '/home/ssm-user/sensu-overview-backup-2026-08-01/lovable-assets/mirror';
const FOLDER = 'sensu/landing';

function signParams(params, secret) {
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha1').update(toSign + secret).digest('hex');
}

const videoExts = new Set(['.mp4', '.webm', '.mov', '.m4v']);

async function upload(filePath, publicId, isVideo) {
  const buf = await readFile(filePath);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const params = { folder: FOLDER, public_id: publicId, timestamp };
  const signature = signParams(params, apiSecret);

  const fd = new FormData();
  const ext = extname(filePath).replace('.', '') || 'bin';
  const mime = isVideo
    ? `video/${ext === 'mov' ? 'quicktime' : ext}`
    : ext === 'svg'
      ? 'image/svg+xml'
      : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  fd.set('file', new Blob([buf], { type: mime }), filePath.split('/').pop());
  fd.set('api_key', apiKey);
  fd.set('timestamp', timestamp);
  fd.set('signature', signature);
  fd.set('folder', FOLDER);
  fd.set('public_id', publicId);

  const endpoint = `https://api.cloudinary.com/v1_1/${cloud}/${isVideo ? 'video' : 'image'}/upload`;
  const res = await fetch(endpoint, { method: 'POST', body: fd });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`upload ${publicId} failed: ${res.status} ${text}`);
  }
  const body = await res.json();
  return body.secure_url;
}

const files = await readdir(SRC);
const manifest = {};
for (const f of files.sort()) {
  const filePath = resolve(SRC, f);
  const ext = extname(f).toLowerCase();
  const base = f.slice(0, -ext.length);
  const isVideo = videoExts.has(ext);
  const publicId = base; // folder is added by FOLDER param; this becomes sensu/landing/{base}
  console.log(`uploading ${f} as ${publicId} (${isVideo ? 'video' : 'image'})...`);
  try {
    const url = await upload(filePath, publicId, isVideo);
    manifest[f] = url;
    console.log(`  → ${url}`);
  } catch (e) {
    console.error(`  FAILED: ${e.message}`);
    manifest[f] = { error: e.message };
  }
}

const outPath = '/home/ssm-user/sensu-overview-backup-2026-08-01/lovable-assets/cloudinary-manifest.json';
await writeFile(outPath, JSON.stringify(manifest, null, 2));
console.log(`\nmanifest saved to ${outPath}`);
