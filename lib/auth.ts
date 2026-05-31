import type { TournamentMeta } from './kv';

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
