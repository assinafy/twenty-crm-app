import { ApiError, type AssinafyClient, type IWebhookEndpoint } from '@assinafy/sdk';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { store, kv } = await vi.hoisted(async () => (await import('src/services/__tests__/kv-store')).createKvStore());

vi.mock('twenty-sdk/logic-function', () => ({ kv }));

import { WEBHOOK_EVENTS } from 'src/constants/assinafy';
import { KV_WEBHOOK_ENDPOINTS } from 'src/constants/kv-keys';
import {
  apiKeyCredential,
  buildResolved,
  sharedCredential,
} from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { reconcileWebhookEndpoints } from 'src/services/reconcile-webhook-endpoints.service';
import { type WebhookEndpoint } from 'src/types/webhook-endpoint';

const ROUTE = 'https://twenty.example.invalid/s/assinafy/webhook';
const EMAIL = 'ops@example.invalid';

const remote = (overrides: Partial<IWebhookEndpoint> = {}): IWebhookEndpoint => ({
  id: 'ep-1',
  name: 'Twenty',
  url: `${ROUTE}?token=tok-1`,
  email: EMAIL,
  events: [...WEBHOOK_EVENTS],
  is_active: true,
  signing_enabled: true,
  created_at: '2026-10-07T12:00:00Z',
  updated_at: '2026-10-07T12:00:00Z',
  ...overrides,
});

const stored = (overrides: Partial<WebhookEndpoint> = {}): WebhookEndpoint => ({
  accountId: 'acc-1',
  endpointId: 'ep-1',
  url: `${ROUTE}?token=tok-1`,
  email: EMAIL,
  token: 'tok-1',
  secret: 'whsec_c2VjcmV0',
  ...overrides,
});

type Webhooks = AssinafyClient['webhooks'];

const buildWebhooks = (endpoints: IWebhookEndpoint[] = []) => ({
  listEndpoints: vi.fn<Webhooks['listEndpoints']>(async () => endpoints),
  createEndpoint: vi.fn<Webhooks['createEndpoint']>(async ({ url }) => remote({ id: 'ep-new', url })),
  updateEndpoint: vi.fn<Webhooks['updateEndpoint']>(async () => remote()),
  deleteEndpoint: vi.fn<Webhooks['deleteEndpoint']>(async () => undefined),
  getEndpointSecret: vi.fn<Webhooks['getEndpointSecret']>(async () => ({ secret: 'whsec_bmV3' })),
});

const account = (webhooks: ReturnType<typeof buildWebhooks>, accountId = 'acc-1', credential = apiKeyCredential) =>
  buildResolved({ webhooks }, accountId, credential);

const saved = () => store.get(KV_WEBHOOK_ENDPOINTS) as WebhookEndpoint[];

describe('reconcileWebhookEndpoints', () => {
  beforeEach(() => {
    store.clear();
    vi.stubEnv('TWENTY_FUNCTIONS_URL', '');
    vi.stubEnv('TWENTY_API_URL', 'https://twenty.example.invalid');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('registers a signed endpoint with a fresh token through the API key and stores its secret', async () => {
    const webhooks = buildWebhooks();

    await reconcileWebhookEndpoints([account(webhooks)], EMAIL);

    const [payload] = webhooks.createEndpoint.mock.calls[0]!;
    expect(payload).toEqual({
      name: 'Twenty',
      url: expect.stringMatching(new RegExp(`^${ROUTE}\\?token=[\\w-]{43}$`)),
      email: EMAIL,
      events: [...WEBHOOK_EVENTS],
      signing_enabled: true,
    });
    expect(webhooks.getEndpointSecret).toHaveBeenCalledExactlyOnceWith('ep-new');
    const [entry] = saved();
    expect(entry).toEqual({
      accountId: 'acc-1',
      endpointId: 'ep-new',
      url: payload.url,
      email: EMAIL,
      token: payload.url.split('token=')[1],
      secret: 'whsec_bmV3',
    });
  });

  it('registers an unsigned endpoint through an OAuth connection, which cannot read signing secrets', async () => {
    const webhooks = buildWebhooks();

    await reconcileWebhookEndpoints([account(webhooks, 'acc-1', sharedCredential)], EMAIL);

    expect(webhooks.createEndpoint).toHaveBeenCalledWith(expect.objectContaining({ signing_enabled: false }));
    expect(webhooks.getEndpointSecret).not.toHaveBeenCalled();
    expect(saved()).toEqual([expect.objectContaining({ endpointId: 'ep-new', secret: null })]);
  });

  it('leaves an endpoint that matches alone and manages each workspace with its first credential', async () => {
    store.set(KV_WEBHOOK_ENDPOINTS, [stored()]);
    const first = buildWebhooks([remote(), remote({ id: 'customer', url: 'https://erp.example.invalid/hook' })]);
    const second = buildWebhooks();

    await reconcileWebhookEndpoints([account(first), account(second, 'acc-1', sharedCredential)], EMAIL);

    expect(first.updateEndpoint).not.toHaveBeenCalled();
    expect(first.deleteEndpoint).not.toHaveBeenCalled();
    expect(second.listEndpoints).not.toHaveBeenCalled();
    expect(saved()).toEqual([stored()]);
  });

  it.each([
    ['the URL changed', { url: 'https://old.example.invalid/s/assinafy/webhook?token=tok-1' }],
    ['the email changed', { email: 'old@example.invalid' }],
    ['it was deactivated', { is_active: false }],
    ['its events differ', { events: ['document_ready'] }],
  ])('updates the stored endpoint when %s', async (_label, drift) => {
    store.set(KV_WEBHOOK_ENDPOINTS, [stored({ email: 'old@example.invalid' })]);
    const webhooks = buildWebhooks([remote(drift)]);

    await reconcileWebhookEndpoints([account(webhooks)], EMAIL);

    expect(webhooks.updateEndpoint).toHaveBeenCalledExactlyOnceWith('ep-1', {
      url: `${ROUTE}?token=tok-1`,
      email: EMAIL,
      events: [...WEBHOOK_EVENTS],
      is_active: true,
    });
    expect(saved()).toEqual([stored()]);
  });

  it('deletes endpoints at its route it no longer knows (a lost entry, a reinstall) before registering a new one', async () => {
    const webhooks = buildWebhooks([remote({ id: 'stale' }), remote({ id: 'customer', url: 'https://erp.example.invalid/hook' })]);

    await reconcileWebhookEndpoints([account(webhooks)], EMAIL);

    expect(webhooks.deleteEndpoint).toHaveBeenCalledExactlyOnceWith('stale');
    expect(webhooks.createEndpoint).toHaveBeenCalledTimes(1);
  });

  it('registers a new endpoint when the stored one was deleted in Assinafy', async () => {
    store.set(KV_WEBHOOK_ENDPOINTS, [stored()]);
    const webhooks = buildWebhooks([]);

    await reconcileWebhookEndpoints([account(webhooks)], EMAIL);

    expect(saved()).toEqual([expect.objectContaining({ endpointId: 'ep-new' })]);
  });

  it('removes its endpoints, and only its own, once webhooks are turned off', async () => {
    store.set(KV_WEBHOOK_ENDPOINTS, [stored()]);
    const webhooks = buildWebhooks([remote(), remote({ id: 'customer', url: 'https://erp.example.invalid/hook' })]);

    await reconcileWebhookEndpoints([account(webhooks)], null);

    expect(webhooks.deleteEndpoint).toHaveBeenCalledExactlyOnceWith('ep-1');
    expect(saved()).toEqual([]);
  });

  it('keeps the entry of a workspace no credential reaches any more', async () => {
    store.set(KV_WEBHOOK_ENDPOINTS, [stored({ accountId: 'acc-gone' })]);

    await reconcileWebhookEndpoints([], null);

    expect(saved()).toEqual([stored({ accountId: 'acc-gone' })]);
  });

  it('keeps the previous entry, and logs the code, when Assinafy refuses (e.g. no free endpoint slot)', async () => {
    store.set(KV_WEBHOOK_ENDPOINTS, [stored({ accountId: 'acc-2' })]);
    const full = buildWebhooks();
    full.createEndpoint.mockRejectedValue(new ApiError('Limit', 403));
    const failing = buildWebhooks();
    failing.listEndpoints.mockRejectedValue(new ApiError('Down', 503));

    await reconcileWebhookEndpoints([account(full), account(failing, 'acc-2')], EMAIL);

    expect(saved()).toEqual([stored({ accountId: 'acc-2' })]);
    expect(console.warn).toHaveBeenCalledWith('[assinafy] webhooks: endpoint not reconciled', { code: 'FORBIDDEN' });
    expect(console.warn).toHaveBeenCalledWith('[assinafy] webhooks: endpoint not reconciled', { code: 'PROVIDER_UNAVAILABLE' });
  });

  it('does nothing without a functions URL to register', async () => {
    vi.stubEnv('TWENTY_API_URL', undefined);
    const webhooks = buildWebhooks();

    await reconcileWebhookEndpoints([account(webhooks)], EMAIL);

    expect(webhooks.listEndpoints).not.toHaveBeenCalled();
    expect(kv.set).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[assinafy] webhooks: no functions URL', { code: 'NO_WEBHOOK_URL' });
  });
});
