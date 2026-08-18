#!/usr/bin/env node
/**
 * Nucleus — mint a dedicated call-center dispatcher account.
 *
 * Creates a User row with role=CALLCENTER, callcenterMode=true, and a
 * strong generated password. Idempotent on email: re-running for the
 * same address resets the password and re-asserts the flags.
 *
 * CALLCENTER role (Juan 2026-06-17) is narrower than ADMIN: lets the
 * dispatcher reach /admin/operator + /admin/check-ins + /admin/fleet
 * and their supporting API routes, but bounces them off /admin/dispatch
 * / /admin/companies / /admin/reporting / /admin/audit / /admin/parity
 * / /admin/marketing — those stay locked to ADMIN role only.
 *
 * Usage:
 *   node scripts/create-callcenter-admin.mjs \
 *     --email dispatcher1@sensu.com.mx \
 *     --name "Dispatcher 1"
 *
 *   # explicit password (otherwise one is generated and printed):
 *   node scripts/create-callcenter-admin.mjs \
 *     --email dispatcher1@sensu.com.mx \
 *     --name "Dispatcher 1" \
 *     --password 'somethingStrong'
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
  const out = {};
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
    }
  }
  if (!out.email || !out.name) {
    console.error('usage: create-callcenter-admin --email <addr> --name <full name> [--password <pw>]');
    process.exit(2);
  }
  return out;
}

function generatePassword() {
  return randomBytes(13).toString('base64url');
}

async function main() {
  const args = parseArgs();
  const password = args.password ?? generatePassword();
  const passwordHash = hashPassword(password);
  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.upsert({
      where: { email: args.email },
      create: {
        email: args.email,
        fullName: args.name,
        passwordHash,
        role: 'CALLCENTER',
        callcenterMode: true,
        kind: 'FAMILY',
        isActive: true,
      },
      update: {
        fullName: args.name,
        passwordHash,
        role: 'CALLCENTER',
        callcenterMode: true,
        isActive: true,
      },
      select: { id: true, email: true, role: true, callcenterMode: true },
    });
    console.log('✓ call-center admin ready');
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
