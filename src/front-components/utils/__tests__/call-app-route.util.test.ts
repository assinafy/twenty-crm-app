import { type RestApiClient, RestApiClientError } from 'twenty-client-sdk/rest';
import { describe, expect, it, vi } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { callAppRoute } from 'src/front-components/utils/call-app-route.util';

const clientReturning = (response: () => Promise<unknown>) => {
  const post = vi.fn<() => Promise<unknown>>(response);

  return Object.assign({ post } as unknown as Pick<RestApiClient, 'post'>, { post });
};

describe('callAppRoute', () => {
  it('posts the body and returns a success envelope', async () => {
    const client = clientReturning(async () => ({ ok: true, estimate: { totalCredits: 0 } }));

    await expect(callAppRoute('/s/assinafy/prepare', { recordId: 'r' }, client)).resolves.toEqual({
      ok: true,
      estimate: { totalCredits: 0 },
    });
    expect(client.post).toHaveBeenCalledWith('/s/assinafy/prepare', { recordId: 'r' });
  });

  it('returns failure envelopes unchanged', async () => {
    const failure = { ok: false, error: { code: 'NOT_CONNECTED', message: 'Connect' } };

    await expect(
      callAppRoute(
        '/s/assinafy/context',
        {},
        clientReturning(async () => failure),
      ),
    ).resolves.toEqual(failure);
  });

  it.each([undefined, 'Bad gateway', { data: 1 }, { ok: 'yes' }])('reports %j as INTERNAL', async (body) => {
    await expect(
      callAppRoute(
        '/s/assinafy/context',
        {},
        clientReturning(async () => body),
      ),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'INTERNAL', message: 'Unexpected response' },
    });
  });

  it('converts RestApiClientError into INTERNAL without logging the body', async () => {
    const client = clientReturning(async () => {
      throw new RestApiClientError('failed', { status: 500, body: { token: LEAK_SENTINELS[0] } });
    });

    await expect(callAppRoute('/s/assinafy/send', {}, client)).resolves.toMatchObject({
      ok: false,
      error: { code: 'INTERNAL' },
    });
    expect(console.error).toHaveBeenCalledWith('[assinafy] route call failed', {
      path: '/s/assinafy/send',
      name: 'RestApiClientError',
    });
  });

  it('converts non-Error throws into INTERNAL', async () => {
    const client = clientReturning(() => Promise.reject('offline'));

    await expect(callAppRoute('/s/assinafy/send', {}, client)).resolves.toMatchObject({ error: { code: 'INTERNAL' } });
    expect(console.error).toHaveBeenCalledWith('[assinafy] route call failed', {
      path: '/s/assinafy/send',
      name: 'string',
    });
  });

  it('uses a RestApiClient by default', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    vi.stubEnv('TWENTY_API_URL', 'https://twenty.test.invalid');
    vi.stubEnv('TWENTY_APP_ACCESS_TOKEN', LEAK_SENTINELS[0]);

    await expect(callAppRoute('/s/assinafy/context', { recordId: 'r' })).resolves.toEqual({ ok: true });
  });
});
