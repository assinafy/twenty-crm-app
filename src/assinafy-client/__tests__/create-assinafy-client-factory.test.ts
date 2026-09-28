import { type AssinafyClient } from '@assinafy/sdk';
import { describe, expect, it } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { createAssinafyClientFactory } from 'src/assinafy-client/create-assinafy-client-factory';
import { type AssinafyCredential } from 'src/types/assinafy-credential';

const BASE_URL = 'https://api.test.invalid/v1';
const ACCESS_TOKEN = LEAK_SENTINELS[0];
const API_KEY = LEAK_SENTINELS[1];

const oauth: AssinafyCredential = { kind: 'shared', connectionId: 'c-1', accessToken: ACCESS_TOKEN, scopes: [] };
const apiKey: AssinafyCredential = { kind: 'apiKey', apiKey: API_KEY, configuredAccountId: null };

type SentRequest = { method: string; url: string; params: Record<string, unknown> | undefined; headers: unknown };

// Replaces the network with a recorder; `status` other than 200 is rejected like axios's own adapters do.
const record = (client: AssinafyClient, status = 200): SentRequest[] => {
  const sent: SentRequest[] = [];
  const instance = client.getAxiosInstance();
  instance.defaults.adapter = async (config) => {
    sent.push({ method: config.method ?? '', url: config.url ?? '', params: config.params, headers: config.headers });
    const response = { data: { status, data: [] }, status, statusText: '', headers: {}, config };
    if (status === 200) return response;
    throw Object.assign(new Error('Rate limited'), {
      isAxiosError: true,
      config,
      response: { ...response, headers: { 'retry-after': '0' } },
    });
  };
  return sent;
};

describe('createAssinafyClientFactory', () => {
  const create = createAssinafyClientFactory(BASE_URL);

  it('adds expand=assignment to GET /documents/{id} only', async () => {
    const client = create(oauth);
    const sent = record(client);

    await client.documents.details('doc-1');
    await client.documents.statuses();
    await client.documents.activities('doc-1');
    await client.documents.delete('doc-1');

    expect(sent.map(({ method, url, params }) => ({ method, url, params }))).toEqual([
      { method: 'get', url: '/documents/doc-1', params: { expand: 'assignment' } },
      { method: 'get', url: '/documents/statuses', params: undefined },
      { method: 'get', url: '/documents/doc-1/activities', params: undefined },
      { method: 'delete', url: '/documents/doc-1', params: undefined },
    ]);
  });

  it('keeps params the SDK already set on document details', async () => {
    const client = create(oauth);
    const sent = record(client);

    await client.getAxiosInstance().get('/documents/doc-1', { params: { page: 2 } });

    expect(sent[0]?.params).toEqual({ page: 2, expand: 'assignment' });
  });

  it('sends an OAuth credential as a bearer token and an API key as X-Api-Key', async () => {
    const bearer = create(oauth);
    const bearerSent = record(bearer);
    const keyed = create(apiKey, { accountId: 'acc-1' });
    const keyedSent = record(keyed);

    await bearer.workspaces.list();
    await keyed.templates.list();

    expect(bearerSent[0]?.headers).toMatchObject({ Authorization: `Bearer ${ACCESS_TOKEN}` });
    expect(bearerSent[0]?.headers).not.toHaveProperty('X-Api-Key');
    expect(keyedSent[0]?.headers).toMatchObject({ 'X-Api-Key': API_KEY });
    expect(keyedSent[0]?.headers).not.toHaveProperty('Authorization');
    expect(keyedSent[0]?.url).toBe('/accounts/acc-1/templates');
  });

  it('targets the given base URL with a 30 s timeout by default', () => {
    const defaults = create(oauth).getAxiosInstance().defaults;

    expect(defaults.baseURL).toBe(BASE_URL);
    expect(defaults.timeout).toBe(30_000);
    expect(create(oauth, { timeoutMs: 5_000 }).getAxiosInstance().defaults.timeout).toBe(5_000);
  });

  it('replays a rate-limited read twice by default and never when maxRetries is 0', async () => {
    const retrying = create(oauth);
    const retryingSent = record(retrying, 429);
    const single = create(oauth, { maxRetries: 0 });
    const singleSent = record(single, 429);

    await expect(retrying.workspaces.list()).rejects.toMatchObject({ statusCode: 429 });
    await expect(single.workspaces.list()).rejects.toMatchObject({ statusCode: 429 });

    expect(retryingSent).toHaveLength(3);
    expect(singleSent).toHaveLength(1);
  });

  it('leaves the default account unset unless one is passed', async () => {
    await expect(create(oauth).templates.list()).rejects.toThrow('Account ID is required');
  });
});
