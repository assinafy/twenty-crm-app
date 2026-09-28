import { reportConnectionAuthFailure } from 'twenty-sdk/logic-function';

import { ASSINAFY_OAUTH_SCOPES } from 'src/constants/assinafy';
import { AUTH_FAILURE_REASON_MAX_LENGTH } from 'src/constants/limits';
import { type AssinafyCredential } from 'src/types/assinafy-credential';
import { type AppFailure } from 'src/utils/app-failure.util';
import { errorName } from 'src/utils/error-name.util';

const reasonFor = (scopes: string[], failure: AppFailure): string | null => {
  if (failure.code === 'RECONNECT_REQUIRED') return 'A Assinafy recusou a conexão. Reconecte para continuar.';
  if (failure.code !== 'INSUFFICIENT_SCOPE') return null;

  const required = failure.details?.['scope'];
  // Reconnecting only helps when the missing scope is one the app asks for and this connection lacks it.
  const missing = (typeof required === 'string' ? required.split(/\s+/) : []).filter(
    (scope) => ASSINAFY_OAUTH_SCOPES.includes(scope) && !scopes.includes(scope),
  );
  if (missing.length === 0) return null;
  return `Reconecte a Assinafy e conceda ${missing.length === 1 ? 'a permissão' : 'as permissões'} ${missing.join(' ')}.`;
};

// Flags the Twenty connection so Settings prompts a reconnect. Best-effort: never masks the original failure.
export const reportCredentialFailure = async (credential: AssinafyCredential, failure: AppFailure): Promise<void> => {
  if (credential.kind === 'apiKey') return;

  const reason = reasonFor(credential.scopes, failure);
  if (reason === null) return;

  try {
    await reportConnectionAuthFailure({
      connectionId: credential.connectionId,
      reason: reason.slice(0, AUTH_FAILURE_REASON_MAX_LENGTH),
    });
  } catch (error) {
    console.warn('[assinafy] reportConnectionAuthFailure failed', {
      name: errorName(error),
    });
  }
};
