import { createHmac } from 'node:crypto';

import { type RoutePayload } from 'twenty-sdk/logic-function';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { listBackgroundCredentials } from 'src/assinafy-client/list-background-credentials';
import { resolveBackgroundAccounts } from 'src/assinafy-client/resolve-background-accounts';
import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';
import { apiKeyCredential, buildResolved } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { receiveAssinafyWebhookHandler } from 'src/logic-functions/handlers/receive-assinafy-webhook.handler';
import { readWebhookEndpoints } from 'src/services/read-webhook-endpoints.service';
import { syncAssinafyDocument } from 'src/services/sync-assinafy-document.service';
import { type WebhookEndpoint } from 'src/types/webhook-endpoint';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('src/assinafy-client/list-background-credentials', () => ({ listBackgroundCredentials: vi.fn<typeof listBackgroundCredentials>() }));
vi.mock('src/assinafy-client/resolve-background-accounts', () => ({ resolveBackgroundAccounts: vi.fn<typeof resolveBackgroundAccounts>() }));
vi.mock('src/data/find-assinafy-documents', () => ({ findAssinafyDocuments: vi.fn<typeof findAssinafyDocuments>() }));
vi.mock('src/services/read-webhook-endpoints.service', () => ({ readWebhookEndpoints: vi.fn<typeof readWebhookEndpoints>() }));
vi.mock('src/services/sync-assinafy-document.service', () => ({ syncAssinafyDocument: vi.fn<typeof syncAssinafyDocument>() }));

const KEY = Buffer.from('webhook-signing-key');
const TOKEN = 'a'.repeat(43);
const signed: WebhookEndpoint = {
  accountId: 'acc-1',
  endpointId: 'ep-1',
  url: `https://twenty.example.invalid/s/assinafy/webhook?token=${TOKEN}`,
  email: 'ops@example.invalid',
  token: TOKEN,
  secret: `whsec_${KEY.toString('base64')}`,
};
const unsigned: WebhookEndpoint = { ...signed, accountId: 'acc-2', endpointId: 'ep-2', token: 'b'.repeat(43), secret: null };
const credential = buildResolved({}, 'acc-1', apiKeyCredential);
const record = buildDocumentRecord({ assinafyDocumentId: 'doc-1', assinafyAccountId: 'acc-1', status: 'PENDING_SIGNATURE' });

const eventBody = (overrides: object = {}) => ({
  id: 184467,
  event: 'signer_signed_document',
  account_id: 'acc-1',
  object: { type: 'Document', id: 'doc-1' },
  ...overrides,
});

const signHeaders = (rawBody: string, key = KEY, timestamp = Math.floor(Date.now() / 1000)) => {
  const signature = createHmac('sha256', key).update(`msg-1.${timestamp}.${rawBody}`).digest('base64');
  return { 'webhook-id': 'msg-1', 'webhook-timestamp': String(timestamp), 'webhook-signature': `v1,${signature}` };
};

const delivery = (
  body: object,
  { token = TOKEN, headers, base64 = false }: { token?: string | null; headers?: Record<string, string>; base64?: boolean } = {},
): RoutePayload => {
  const rawBody = JSON.stringify(body);
  return {
    headers: headers ?? signHeaders(rawBody),
    queryStringParameters: token === null ? {} : { token },
    pathParameters: {},
    body,
    rawBody: base64 ? Buffer.from(rawBody).toString('base64') : rawBody,
    isBase64Encoded: base64,
    requestContext: { http: { method: 'POST', path: '/s/assinafy/webhook' } },
    userWorkspaceId: null,
  };
};

describe('receiveAssinafyWebhookHandler', () => {
  beforeEach(() => {
    vi.mocked(readWebhookEndpoints).mockResolvedValue([signed, unsigned]);
    vi.mocked(findAssinafyDocuments).mockResolvedValue([record]);
    vi.mocked(listBackgroundCredentials).mockResolvedValue([apiKeyCredential]);
    vi.mocked(resolveBackgroundAccounts).mockResolvedValue([credential]);
    vi.mocked(syncAssinafyDocument).mockResolvedValue(record);
  });

  it('re-reads the document of a signed delivery from Assinafy with the workspace credential, as the app', async () => {
    const ctx = buildContext({ userWorkspaceId: null });

    await expect(receiveAssinafyWebhookHandler(delivery(eventBody()), ctx)).resolves.toBe('synced');

    expect(findAssinafyDocuments).toHaveBeenCalledExactlyOnceWith(ctx.appCore, {
      filter: { assinafyDocumentId: { eq: 'doc-1' } },
      first: 1,
    });
    expect(resolveBackgroundAccounts).toHaveBeenCalledWith('receive-assinafy-webhook', [apiKeyCredential], ctx.createAssinafyClient);
    expect(syncAssinafyDocument).toHaveBeenCalledExactlyOnceWith(ctx, record, credential);
  });

  it('verifies a base64-encoded raw body', async () => {
    const body = eventBody();
    await expect(
      receiveAssinafyWebhookHandler(delivery(body, { base64: true, headers: signHeaders(JSON.stringify(body)) }), buildContext()),
    ).resolves.toBe('synced');
  });

  it('accepts a delivery to an unsigned endpoint on its token alone', async () => {
    vi.mocked(resolveBackgroundAccounts).mockResolvedValue([buildResolved({}, 'acc-2')]);
    vi.mocked(findAssinafyDocuments).mockResolvedValue([{ ...record, assinafyAccountId: 'acc-2' }]);

    await expect(
      receiveAssinafyWebhookHandler(delivery(eventBody({ account_id: 'acc-2' }), { token: unsigned.token, headers: {} }), buildContext()),
    ).resolves.toBe('synced');
  });

  it.each([
    ['an unknown token', { token: 'c'.repeat(43) }],
    ['a token of another length', { token: 'short' }],
    ['no token', { token: null }],
    ['a signature made with another key', { headers: signHeaders(JSON.stringify(eventBody()), Buffer.from('other')) }],
    ['an expired signature', { headers: signHeaders(JSON.stringify(eventBody()), KEY, 1_000_000) }],
    ['no signature on a signed endpoint', { headers: {} }],
  ])('refuses %s without reading anything', async (_label, options) => {
    await expect(receiveAssinafyWebhookHandler(delivery(eventBody(), options), buildContext())).resolves.toBe('unauthorized');

    expect(findAssinafyDocuments).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[assinafy] receive-assinafy-webhook: delivery refused', { code: 'UNAUTHORIZED' });
  });

  it.each([
    ['another workspace', eventBody({ account_id: 'acc-2' })],
    ['a signer', eventBody({ object: { type: 'Signer', id: 'signer-1' } })],
    ['an object without an id', eventBody({ object: { type: 'Document' } })],
    ['no object', eventBody({ object: undefined })],
  ])('ignores an event about %s', async (_label, body) => {
    await expect(receiveAssinafyWebhookHandler(delivery(body), buildContext())).resolves.toBe('ignored');
    expect(findAssinafyDocuments).not.toHaveBeenCalled();
  });

  it.each([
    ['no record', []],
    ['a record of another Assinafy workspace', [{ ...record, assinafyAccountId: 'acc-9' }]],
    ['a record in a final status', [{ ...record, status: 'CERTIFICATED' as const }]],
  ])('ignores a document with %s', async (_label, records) => {
    vi.mocked(findAssinafyDocuments).mockResolvedValue(records);

    await expect(receiveAssinafyWebhookHandler(delivery(eventBody()), buildContext())).resolves.toBe('ignored');
    expect(syncAssinafyDocument).not.toHaveBeenCalled();
  });

  it('leaves the document to the periodic sync when no credential reaches its workspace', async () => {
    vi.mocked(resolveBackgroundAccounts).mockResolvedValue([]);

    await expect(receiveAssinafyWebhookHandler(delivery(eventBody()), buildContext())).resolves.toBe('failed');
    expect(syncAssinafyDocument).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[assinafy] receive-assinafy-webhook: no credential', { code: 'NO_CREDENTIAL' });
  });

  it('logs a failed sync and leaves the document to the periodic sync', async () => {
    vi.mocked(syncAssinafyDocument).mockRejectedValue(new AppFailure('RATE_LIMITED', 'Slow down'));

    await expect(receiveAssinafyWebhookHandler(delivery(eventBody()), buildContext())).resolves.toBe('failed');
    expect(console.warn).toHaveBeenCalledWith('[assinafy] receive-assinafy-webhook: sync failed', { code: 'RATE_LIMITED' });
  });
});
