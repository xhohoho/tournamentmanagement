import { kv } from '@vercel/kv';
import { randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import type { NextRequest } from 'next/server';
import type { TournamentMeta } from './kv';

const scryptAsync = promisify(scrypt);

// ─── Token constants ──────────────────────────────────────────────────────────
export const TOKEN_TTL = 60 * 60 * 8; // 8 hours in seconds
export const TOKEN_PREFIX = 'admin:token:';
export const CURRENT_TOKEN_PREFIX = 'admin:currenttoken:';

// ─── Password helpers ─────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored.includes(':')) return password === stored; // legacy plaintext
  const [salt, hashHex] = stored.split(':');
  const storedHash = Buffer.from(hashHex, 'hex');
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return storedHash.length === derived.length && timingSafeEqual(storedHash, derived);
}

// ─── Token helpers ────────────────────────────────────────────────────────────

/**
 * Verifies the X-Admin-Token header against KV.
 * Returns the adminId if valid, null otherwise.
 */
export async function verifyAdminToken(req: NextRequest): Promise<string | null> {
  const token = req.headers.get('X-Admin-Token');
  if (!token) return null;
  try {
    const adminId = await kv.get<string>(`${TOKEN_PREFIX}${token}`);
    return adminId ?? null;
  } catch {
    return null;
  }
}

/** Convenience — returns true/false for routes that only need an auth check. */
export async function isAdminTokenValid(req: NextRequest): Promise<boolean> {
  return (await verifyAdminToken(req)) !== null;
}

/**
 * Issues a new token for the given adminId, revoking any existing one first.
 * Stores both forward (token → adminId) and reverse (adminId → token) mappings.
 */
export async function createAdminToken(adminId: string): Promise<string> {
  const reverseKey = `${CURRENT_TOKEN_PREFIX}${adminId}`;
  const oldToken = await kv.get<string>(reverseKey);
  if (oldToken) await kv.del(`${TOKEN_PREFIX}${oldToken}`);

  const token = randomBytes(32).toString('hex');
  await kv.set(`${TOKEN_PREFIX}${token}`, adminId, { ex: TOKEN_TTL });
  await kv.set(reverseKey, token, { ex: TOKEN_TTL });
  return token;
}

/**
 * Revokes a token and cleans up the reverse mapping.
 */
export async function revokeAdminToken(token: string): Promise<void> {
  const adminId = await kv.get<string>(`${TOKEN_PREFIX}${token}`);
  await kv.del(`${TOKEN_PREFIX}${token}`);
  if (adminId) await kv.del(`${CURRENT_TOKEN_PREFIX}${adminId}`);
}

// ─── Tournament access ────────────────────────────────────────────────────────

/**
 * Returns true if the given admin is allowed to manage a tournament.
 * Rules:
 *  - Super admin: always allowed
 *  - Owner: always allowed
 *  - Collaborator: allowed if their adminId is in meta.collaborators
 */
export function canAccessTournament(
  adminId: string,
  isSuperAdmin: boolean,
  meta: TournamentMeta,
): boolean {
  if (isSuperAdmin) return true;
  if (meta.ownerAdminId === adminId) return true;
  if (meta.collaborators?.includes(adminId)) return true;
  return false;
}
