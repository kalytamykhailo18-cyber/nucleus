#!/usr/bin/env node
/**
 * Nucleus — mint a dedicated call-center dispatcher account.
 *
 * Creates a User row with role=CALLCENTER, callcenterMode=true, and a
 * strong generated password.
 *
 * NOT silently idempotent on password. Re-running for an EXISTING email
 * refuses to touch the row unless `--rotate-password` is passed, since
 * that quiet rotation is what locked every dispatcher out of the
 * call-center account on 2026-08-21 when the script was re-run just to
 * look up the password. `--rotate-password` still overwrites — pass it
 * only when every dispatcher who holds the current password is ready to
 * pick up the new one from you the moment this exits.
 *
 * CALLCENTER role (Juan 2026-06-17) is narrower than ADMIN: lets the
 * dispatcher reach /admin/operator + /admin/check-ins + /admin/fleet
 * and their supporting API routes, but bounces them off /admin/dispatch
 * / /admin/companies / /admin/reporting / /admin/audit / /admin/parity
 * / /admin/marketing — those stay locked to ADMIN role only.
 *
 * Usage:
 *   # create a brand-new dispatcher account:
 *   node scripts/create-callcenter-admin.mjs \
 *     --email dispatcher1@sensu.com.mx \
 *     --name "Dispatcher 1"
 *
 *   # explicit password on create (otherwise one is generated and printed):
 *   node scripts/create-callcenter-admin.mjs \
 *     --email dispatcher1@sensu.com.mx \
 *     --name "Dispatcher 1" \
 *     --password 'somethingStrong'
 *
 *   # deliberately rotate the password on an existing row (locks out
 *   # every dispatcher holding the previous copy — coordinate first):
 *   node scripts/create-callcenter-admin.mjs \
 *     --email dispatcher1@sensu.com.mx \
 *     --name "Dispatcher 1" \
 *     --rotate-password
 *
 * Run with DATABASE_URL pointing at 127.0.0.1:5432 (the host-published
 * port). Sourcing the repo-root .env picks it up automatically.
 */
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

// Bit-compatible with apps/web/lib/password.ts (PBKDF2-HMAC-SHA256,
// 100_000 rounds, 32-byte salt, 32-byte key, hex-encoded salt+hash).
function hashPassword(password) {
  const salt = randomBytes(32);
  const hash = pbkdf2Sync(password, salt, 100_000, 32, 'sha256');
  return salt.toString('hex') + hash.toString('hex');
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const out = { rotate: false };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const val = argv[i + 1];
    if (flag === '--email') {
      out.email = val;
      i++;
    } else if (flag === '--name') {
      out.name = val;
      i++;
    } else if (flag === '--password') {
      out.password = val;
      i++;
    } else if (flag === '--rotate-password') {
      out.rotate = true;
    }
  }
  if (!out.email || !out.name) {
    console.error('usage: create-callcenter-admin --email <addr> --name <full name> [--password <pw>] [--rotate-password]');
    process.exit(2);
  }
  return out;
}

function generatePassword() {
  return randomBytes(13).toString('base64url');
}

async function main() {
  const args = parseArgs();
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({
      where: { email: args.email },
      select: { id: true, email: true, role: true, callcenterMode: true, fullName: true },
    });

    if (existing && !args.rotate) {
      console.error('');
      console.error(`✗ user ${args.email} already exists (id=${existing.id}, role=${existing.role}).`);
      console.error('  This script no longer silently rotates the password on re-runs — the previous idempotent behaviour locked every dispatcher out on 2026-08-21 when it was re-run just to look up the password.');
      console.error('');
      console.error('  If you only need to see the current state, query the DB directly:');
      console.error(`    SELECT id, email, role, "callcenterMode", "isActive", "updatedAt" FROM "User" WHERE email='${args.email}';`);
      console.error('');
      console.error('  If you genuinely want to overwrite the password (and are ready to hand the new one to every dispatcher currently holding the old copy):');
      console.error(`    node ${process.argv[1].split('/').pop()} --email ${args.email} --name "${existing.fullName}" --rotate-password`);
      console.error('');
      process.exit(3);
    }

    const password = args.password ?? generatePassword();
    const passwordHash = hashPassword(password);

    const user = existing
      ? await prisma.user.update({
          where: { email: args.email },
          data: {
            fullName: args.name,
            passwordHash,
            role: 'CALLCENTER',
            callcenterMode: true,
            isActive: true,
          },
          select: { id: true, email: true, role: true, callcenterMode: true },
        })
      : await prisma.user.create({
          data: {
            email: args.email,
            fullName: args.name,
            passwordHash,
            role: 'CALLCENTER',
            callcenterMode: true,
            kind: 'FAMILY',
            isActive: true,
          },
          select: { id: true, email: true, role: true, callcenterMode: true },
        });

    console.log(existing ? '✓ call-center admin password rotated' : '✓ call-center admin created');
    if (existing) {
      console.warn('  WARNING: every dispatcher holding the previous password is now locked out. Hand them the new password below immediately.');
    }
    console.log(`  email:     ${user.email}`);
    console.log(`  password:  ${password}`);
    console.log(`  role:      ${user.role}`);
    console.log(`  ccMode:    ${user.callcenterMode}`);
    console.log(`  user.id:   ${user.id}`);
    console.log('');
    console.log('Hand the email + password to the dispatcher. Login at https://app.sensu.com.mx/login → /admin/operator.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
