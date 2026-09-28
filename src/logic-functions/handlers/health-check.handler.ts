import { type ApplicationHealthCheckResult } from 'twenty-sdk/define';

import { listBackgroundCredentials } from 'src/assinafy-client/list-background-credentials';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { type CREDENTIAL_FAILURE_CODES } from 'src/constants/credential-failure-codes';
import { type AppErrorCode } from 'src/types/app-error-code';
import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';
import { toAppError } from 'src/utils/to-app-error.util';

type FixableCode = (typeof CREDENTIAL_FAILURE_CODES)[number];

// Failures a person can fix from the settings page. Anything else (outage, rate limit) is rethrown: Twenty then shows
// no banner instead of painting the app red for a transient problem.
const FIXABLE_FAILURES: Record<FixableCode, string> = {
  RECONNECT_REQUIRED: 'foi recusada',
  INSUFFICIENT_SCOPE: 'não tem todas as permissões necessárias',
  FORBIDDEN: 'não tem acesso ao workspace',
  ACCOUNT_REQUIRED: 'acessa vários workspaces',
};

// What to do, by credential kind: the API key lives in the Variables tab, connections in the General tab.
const API_KEY_ADVICE: Record<FixableCode, string> = {
  RECONNECT_REQUIRED: 'Crie uma nova chave de API na Assinafy e salve-a na aba Variáveis.',
  INSUFFICIENT_SCOPE: 'Crie na Assinafy uma chave de API com acesso a documentos e modelos e salve-a na aba Variáveis.',
  FORBIDDEN:
    'Confira o ID do workspace na Assinafy na aba Variáveis ou use a chave de um usuário com acesso a esse workspace.',
  ACCOUNT_REQUIRED: 'Preencha o ID do workspace na Assinafy na aba Variáveis.',
};
const CONNECTION_ADVICE: Record<FixableCode, string> = {
  RECONNECT_REQUIRED: 'A autorização expirou ou foi revogada na Assinafy. Reconecte-a na aba Geral.',
  INSUFFICIENT_SCOPE: 'Reconecte-a na aba Geral e aprove todas as permissões solicitadas.',
  FORBIDDEN: 'Reconecte-a na aba Geral com um usuário da Assinafy que tenha acesso ao workspace.',
  // Required by the type only: resolveCredentialAccount raises ACCOUNT_REQUIRED for the API key alone.
  ACCOUNT_REQUIRED: 'Reconecte-a na aba Geral.',
};

const isFixable = (code: AppErrorCode): code is FixableCode => code in FIXABLE_FAILURES;

// Checks what the background sync uses (API key and workspace-shared connections): personal connections are
// checked each time their owner acts.
export const healthCheckHandler = async (
  createClient: CreateAssinafyClient,
): Promise<ApplicationHealthCheckResult> => {
  const credentials = await listBackgroundCredentials();

  if (credentials.length === 0) {
    return {
      status: 'WARNING',
      title: 'A Assinafy não está conectada ao workspace',
      description:
        'Adicione uma conexão compartilhada com o workspace na seção Assinafy da aba Geral (uma conexão deixa de ' +
        'funcionar se ficar 30 dias sem uso ou for revogada na Assinafy; reconecte-a quando isso acontecer), ou ' +
        'defina uma chave de API da Assinafy. Até lá, os status das assinaturas só são atualizados quando alguém ' +
        'abre um documento.',
      // No location: the button opens the app's Variables tab, where the API key is set.
      action: { label: 'Definir chave de API' },
    };
  }

  for (const credential of credentials) {
    try {
      await resolveCredentialAccount(credential, createClient, { timeoutMs: 5_000, maxRetries: 0 });
    } catch (error) {
      const failure = toAppError(error, 'read');
      if (!isFixable(failure.code)) throw failure;

      const isApiKey = credential.kind === 'apiKey';
      return {
        status: 'ERROR',
        title: `${isApiKey ? 'A chave de API da Assinafy' : 'Uma conexão compartilhada com a Assinafy'} ${FIXABLE_FAILURES[failure.code]}`,
        description: (isApiKey ? API_KEY_ADVICE : CONNECTION_ADVICE)[failure.code],
        action: isApiKey ? { label: 'Atualizar chave de API' } : { label: 'Reconectar', location: '#general' },
      };
    }
  }

  return { status: 'OK' };
};
