import { beforeEach, describe, expect, it, vi } from 'vitest';

import { listBackgroundCredentials } from 'src/assinafy-client/list-background-credentials';
import { resolveCredentialAccount } from 'src/assinafy-client/resolve-credential-account';
import { healthCheckHandler } from 'src/logic-functions/handlers/health-check.handler';
import {
  apiKeyCredential,
  buildResolved,
  sharedCredential,
} from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { readWebhookEndpoints } from 'src/services/read-webhook-endpoints.service';
import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';
import { AppFailure } from 'src/utils/app-failure.util';
import { readWebhookEmail } from 'src/utils/read-webhook-email.util';

vi.mock('src/assinafy-client/list-background-credentials', () => ({ listBackgroundCredentials: vi.fn<typeof listBackgroundCredentials>() }));
vi.mock('src/assinafy-client/resolve-credential-account', () => ({ resolveCredentialAccount: vi.fn<typeof resolveCredentialAccount>() }));
vi.mock('src/services/read-webhook-endpoints.service', () => ({ readWebhookEndpoints: vi.fn<typeof readWebhookEndpoints>() }));
vi.mock('src/utils/read-webhook-email.util', () => ({ readWebhookEmail: vi.fn<typeof readWebhookEmail>() }));

const listCredentials = vi.mocked(listBackgroundCredentials);
const resolve = vi.mocked(resolveCredentialAccount);
const createClient = vi.fn<CreateAssinafyClient>();

describe('healthCheckHandler', () => {
  beforeEach(() => {
    listCredentials.mockResolvedValue([apiKeyCredential, sharedCredential]);
    resolve.mockImplementation(async (credential) => buildResolved({}, 'acc-1', credential));
    vi.mocked(readWebhookEmail).mockReturnValue(null);
    vi.mocked(readWebhookEndpoints).mockResolvedValue([]);
  });

  it('warns while webhooks are on and no endpoint is registered', async () => {
    vi.mocked(readWebhookEmail).mockReturnValue('ops@example.invalid');

    await expect(healthCheckHandler(createClient)).resolves.toMatchObject({
      status: 'WARNING',
      title: 'Os webhooks da Assinafy ainda não estão registrados',
      description: expect.stringContaining('webhooks:write'),
    });
  });

  it('is OK once a webhook endpoint is registered', async () => {
    vi.mocked(readWebhookEmail).mockReturnValue('ops@example.invalid');
    vi.mocked(readWebhookEndpoints).mockResolvedValue([
      {
        accountId: 'acc-1',
        endpointId: 'ep-1',
        url: 'https://twenty.example.invalid/s/assinafy/webhook?token=t',
        email: 'ops@example.invalid',
        token: 't',
        secret: null,
      },
    ]);

    await expect(healthCheckHandler(createClient)).resolves.toEqual({ status: 'OK' });
  });

  it('warns when the workspace has no background credential, pointing at the API key variables', async () => {
    listCredentials.mockResolvedValue([]);

    const result = await healthCheckHandler(createClient);

    expect(result).toMatchObject({
      status: 'WARNING',
      title: 'A Assinafy não está conectada ao workspace',
      action: { label: 'Definir chave de API' },
    });
    expect(result).not.toHaveProperty('action.location');
    expect(result).toHaveProperty('description', expect.stringContaining('30 dias sem uso ou for revogada'));
    expect(result).not.toHaveProperty('description', expect.stringMatching(/após 30 dias|a cada 30 dias/));
    expect(resolve).not.toHaveBeenCalled();
  });

  it('is OK when every credential reaches its workspace, with a short timeout and no retries', async () => {
    await expect(healthCheckHandler(createClient)).resolves.toEqual({ status: 'OK' });

    expect(resolve).toHaveBeenCalledTimes(2);
    expect(resolve).toHaveBeenCalledWith(apiKeyCredential, createClient, { timeoutMs: 5_000, maxRetries: 0 });
    expect(resolve).toHaveBeenCalledWith(sharedCredential, createClient, { timeoutMs: 5_000, maxRetries: 0 });
  });

  it.each([
    [
      'RECONNECT_REQUIRED',
      'A chave de API da Assinafy foi recusada',
      'Crie uma nova chave de API na Assinafy e salve-a na aba Variáveis.',
    ],
    [
      'FORBIDDEN',
      'A chave de API da Assinafy não tem acesso ao workspace',
      'Confira o ID do workspace na Assinafy na aba Variáveis ou use a chave de um usuário com acesso a esse workspace.',
    ],
    [
      'ACCOUNT_REQUIRED',
      'A chave de API da Assinafy acessa vários workspaces',
      'Preencha o ID do workspace na Assinafy na aba Variáveis.',
    ],
    [
      'INSUFFICIENT_SCOPE',
      'A chave de API da Assinafy não tem todas as permissões necessárias',
      'Crie na Assinafy uma chave de API com acesso a documentos e modelos e salve-a na aba Variáveis.',
    ],
  ] as const)('reports an API key failing with %s as an error to fix in the variables', async (code, title, description) => {
    resolve.mockRejectedValueOnce(new AppFailure(code, 'Mensagem genérica.'));

    const result = await healthCheckHandler(createClient);

    expect(result).toEqual({
      status: 'ERROR',
      title,
      description,
      action: { label: 'Atualizar chave de API' },
    });
    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'RECONNECT_REQUIRED',
      'Uma conexão compartilhada com a Assinafy foi recusada',
      'A autorização expirou ou foi revogada na Assinafy. Reconecte-a na aba Geral.',
    ],
    [
      'FORBIDDEN',
      'Uma conexão compartilhada com a Assinafy não tem acesso ao workspace',
      'Reconecte-a na aba Geral com um usuário da Assinafy que tenha acesso ao workspace.',
    ],
    [
      'INSUFFICIENT_SCOPE',
      'Uma conexão compartilhada com a Assinafy não tem todas as permissões necessárias',
      'Reconecte-a na aba Geral e aprove todas as permissões solicitadas.',
    ],
  ] as const)('reports a shared connection failing with %s as an error to reconnect', async (code, title, description) => {
    listCredentials.mockResolvedValue([sharedCredential]);
    resolve.mockRejectedValueOnce(new AppFailure(code, 'Mensagem genérica.'));

    await expect(healthCheckHandler(createClient)).resolves.toEqual({
      status: 'ERROR',
      title,
      description,
      action: { label: 'Reconectar', location: '#general' },
    });
  });

  it.each(['PROVIDER_UNAVAILABLE', 'RATE_LIMITED', 'INTERNAL'] as const)(
    'throws on %s so Twenty shows no banner for a transient problem',
    async (code) => {
      resolve.mockRejectedValueOnce(new AppFailure(code, 'Transient'));

      await expect(healthCheckHandler(createClient)).rejects.toMatchObject({ code });
    },
  );

  it('throws when the credentials cannot be listed', async () => {
    listCredentials.mockRejectedValue(new AppFailure('PROVIDER_UNAVAILABLE', 'Down'));

    await expect(healthCheckHandler(createClient)).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
  });
});
