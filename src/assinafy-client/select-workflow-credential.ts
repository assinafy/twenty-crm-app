import { listBackgroundCredentials } from 'src/assinafy-client/list-background-credentials';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { type HandlerContext } from 'src/types/handler-context';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { AppFailure } from 'src/utils/app-failure.util';

// No person runs a workflow: personal connections are never candidates, and the first credential is the only one
// used. Without an API key, every shared connection must reach the same Assinafy workspace, so a run never sends from
// (and bills) another workspace than the previous one, e.g. when the first connection lapses.
export const selectWorkflowCredential = async (
  ctx: Pick<HandlerContext, 'createAssinafyClient'>,
): Promise<ResolvedCredential> => {
  const credentials = await listBackgroundCredentials();
  const [first] = credentials;
  if (!first) {
    throw new AppFailure(
      'NOT_CONNECTED',
      'Os fluxos de trabalho precisam da chave de API da Assinafy ou de uma conexão com a Assinafy compartilhada com o workspace.',
    );
  }

  const chosen = await resolveCredentialAccount(first, ctx.createAssinafyClient);
  if (first.kind === 'apiKey') return chosen;

  // Sequential on purpose: parallel calls race Twenty's token refresh. Read-only, before any mutating call.
  for (const other of credentials.slice(1)) {
    const { accountId } = await resolveCredentialAccount(other, ctx.createAssinafyClient);
    if (accountId !== chosen.accountId) {
      throw new AppFailure(
        'ACCOUNT_REQUIRED',
        'As conexões compartilhadas com o workspace dão acesso a workspaces diferentes da Assinafy. Defina a chave ' +
          'de API da Assinafy ou mantenha conexões compartilhadas com um único workspace da Assinafy para usar ' +
          'fluxos de trabalho.',
      );
    }
  }
  return chosen;
};
