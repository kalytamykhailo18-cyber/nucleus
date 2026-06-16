import crypto from 'node:crypto';

/**
 * PBKDF2-HMAC-SHA256 password hashing — bit-compatible with sensu-api
 * (auth/core.py PasswordManager) and sensu-pay
 * (lib/actions/update-customer-questionnaire.ts hashPassword).
 *
 * Format on disk: salt(32 bytes hex = 64 chars) + hash(32 bytes hex = 64 chars).
 * Iterations: 100_000. Hash algorithm: SHA-256. Derived key length: 32 bytes.
 *
 * A user created by any of the three platforms can authenticate against the
 * other two without migration — that is the point.
 */

const ITERATIONS = 100_000;
const KEY_LEN = 32;
const SALT_LEN = 32;
const DIGEST = 'sha256';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(SALT_LEN);
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST);
  return salt.toString('hex') + hash.toString('hex');
}

export function verifyPassword(password: string, stored: string): boolean {
  if (typeof stored !== 'string' || stored.length !== (SALT_LEN + KEY_LEN) * 2) {
    return false;
  }
  try {
    const salt = Buffer.from(stored.slice(0, SALT_LEN * 2), 'hex');
    const expected = Buffer.from(stored.slice(SALT_LEN * 2), 'hex');
    const actual = crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LEN, DIGEST);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
