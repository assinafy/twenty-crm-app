import { listInteractiveCredentials } from 'src/assinafy-client/list-interactive-credentials';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { CREDENTIAL_FAILURE_CODES } from 'src/constants/credential-failure-codes';
import { NOT_CONNECTED_MESSAGE } from 'src/constants/not-connected-message';
import { type AppErrorCode } from 'src/types/app-error-code';
import { type HandlerContext } from 'src/types/handler-context';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { AppFailure } from 'src/utils/app-failure.util';

// Failures that only rule out this candidate; anything else (outage, rate limit) stops the search.
const SKIPPABLE_CODES: readonly AppErrorCode[] = CREDENTIAL_FAILURE_CODES;

export const selectDocumentCredential = async (
  ctx: Pick<HandlerContext, 'createAssinafyClient'> & { userWorkspaceId: string },
  accountId: string,
): Promise<ResolvedCredential> => {
  const candidates = await listInteractiveCredentials(ctx.userWorkspaceId);
  if (candidates.length === 0) throw new AppFailure('NOT_CONNECTED', NOT_CONNECTED_MESSAGE);

  let everyCandidateNeedsReconnect = true;
  for (const candidate of candidates) {
    try {
      const resolved = await resolveCredentialAccount(candidate, ctx.createAssinafyClient);
      if (resolved.accountId === accountId) return resolved;
      everyCandidateNeedsReconnect = false;
    } catch (error) {
      if (!(error instanceof AppFailure) || !SKIPPABLE_CODES.includes(error.code)) throw error;
      if (error.code !== 'RECONNECT_REQUIRED' && error.code !== 'INSUFFICIENT_SCOPE') {
        everyCandidateNeedsReconnect = false;
      }
    }
  }

  if (everyCandidateNeedsReconnect) {
    throw new AppFailure('RECONNECT_REQUIRED', 'A Assinafy recusou todas as credenciais disponíveis. Reconecte a Assinafy.');
  }
  throw new AppFailure('FORBIDDEN', 'Nenhuma credencial disponível da Assinafy tem acesso ao workspace deste documento.', {
    accountId,
  });
};
