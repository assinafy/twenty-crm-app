import { listInteractiveCredentials } from 'src/assinafy-client/list-interactive-credentials';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { NOT_CONNECTED_MESSAGE } from 'src/constants/not-connected-message';
import { type HandlerContext } from 'src/types/handler-context';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { AppFailure } from 'src/utils/app-failure.util';

// Only the first candidate: falling through to another credential would send from a workspace the user did not pick.
export const selectSendCredential = async (
  ctx: Pick<HandlerContext, 'userWorkspaceId' | 'createAssinafyClient'>,
): Promise<ResolvedCredential> => {
  if (ctx.userWorkspaceId === null) {
    throw new AppFailure('FORBIDDEN', 'O envio para assinatura exige um membro do workspace.');
  }

  const [credential] = await listInteractiveCredentials(ctx.userWorkspaceId);
  if (!credential) throw new AppFailure('NOT_CONNECTED', NOT_CONNECTED_MESSAGE);

  return resolveCredentialAccount(credential, ctx.createAssinafyClient);
};
