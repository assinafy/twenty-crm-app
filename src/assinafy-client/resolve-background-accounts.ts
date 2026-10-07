import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { type AssinafyCredential } from 'src/types/assinafy-credential';
import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { toAppError } from 'src/utils/to-app-error.util';

// One workspaces.list per credential, in order; a failing credential is skipped (and logged under `operation`), so it
// only loses its own Assinafy workspace.
export const resolveBackgroundAccounts = async (
  operation: string,
  credentials: AssinafyCredential[],
  createClient: CreateAssinafyClient,
): Promise<ResolvedCredential[]> => {
  const resolved: ResolvedCredential[] = [];
  for (const credential of credentials) {
    try {
      resolved.push(await resolveCredentialAccount(credential, createClient));
    } catch (error) {
      console.warn(`[assinafy] ${operation}: credential skipped`, { code: toAppError(error, 'read').code });
    }
  }
  return resolved;
};
