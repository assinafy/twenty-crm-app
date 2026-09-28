import { type IWorkspaceListItem } from '@assinafy/sdk';

import { reportCredentialFailure } from 'src/assinafy-client/report-credential-failure';
import { type AssinafyCredential } from 'src/types/assinafy-credential';
import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { AppFailure } from 'src/utils/app-failure.util';
import { toAppError } from 'src/utils/to-app-error.util';

const pickAccount = (credential: AssinafyCredential, accounts: IWorkspaceListItem[]): IWorkspaceListItem => {
  const [first] = accounts;

  if (credential.kind !== 'apiKey') {
    // An OAuth grant is bound to exactly one Assinafy workspace; none means the grant no longer reaches it.
    if (first && accounts.length === 1) return first;
    if (accounts.length === 0) {
      throw new AppFailure(
        'RECONNECT_REQUIRED',
        'A conexão com a Assinafy não dá mais acesso a nenhum workspace. Reconecte a Assinafy.',
      );
    }
    throw new AppFailure('INTERNAL', 'A Assinafy retornou uma lista de workspaces inesperada para esta conexão.');
  }

  if (credential.configuredAccountId !== null) {
    const configured = accounts.find((account) => account.id === credential.configuredAccountId);
    if (configured) return configured;
    throw new AppFailure(
      'FORBIDDEN',
      'A chave de API da Assinafy não tem acesso ao workspace configurado (ASSINAFY_ACCOUNT_ID).',
    );
  }

  if (first && accounts.length === 1) return first;
  if (accounts.length > 1) {
    throw new AppFailure(
      'ACCOUNT_REQUIRED',
      'A chave de API da Assinafy acessa vários workspaces. Defina ASSINAFY_ACCOUNT_ID para escolher um.',
    );
  }
  throw new AppFailure('FORBIDDEN', 'A chave de API da Assinafy não tem acesso a nenhum workspace.');
};

export const resolveCredentialAccount = async (
  credential: AssinafyCredential,
  createClient: CreateAssinafyClient,
  options: { timeoutMs?: number; maxRetries?: number } = {},
): Promise<ResolvedCredential> => {
  try {
    const { data } = await createClient(credential, options).workspaces.list();
    const account = pickAccount(credential, data);

    return {
      credential,
      accountId: account.id,
      accountName: account.name,
      client: createClient(credential, { ...options, accountId: account.id }),
    };
  } catch (error) {
    const failure = toAppError(error, 'read');
    await reportCredentialFailure(credential, failure);
    throw failure;
  }
};
