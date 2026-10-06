import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createSimulator } from 'src/__tests__/e2e/simulator/assinafy-simulator.mjs';

const UPSTREAM_KEY = 'test-api-key-9c1e';
const APP_API_KEY = 'app-api-key-sim';
const CLIENT_ID = 'sim-client';
const CLIENT_SECRET = 'test-client-secret-4b2d';
const REDIRECT_URI = 'http://localhost:2021/auth/apps/callback';
const ISSUER = 'http://localhost:4010';
const ACCOUNT_ID = 'acc-1';
const ALL_SCOPES = 'documents:read documents:write templates:read templates:write account:read offline_access';
const BINARY = Buffer.from(Array.from({ length: 1024 }, (_, index) => index % 256));
const SIMULATOR_PATH = fileURLToPath(new URL('../assinafy-simulator.mjs', import.meta.url));

type UpstreamRequest = { method: string; url: string; headers: IncomingMessage['headers']; body: Buffer };
type TokenBody = { access_token: string; refresh_token?: string; scope: string; token_type: string; expires_in: number };

let upstream: Server;
let upstreamRequests: UpstreamRequest[];
let simulator: ReturnType<typeof createSimulator>;
let base: string;
// Status the upstream stub answers GET /v1/accounts with.
let accountsStatus = 200;

const startUpstream = async () => {
  upstreamRequests = [];
  accountsStatus = 200;
  upstream = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      upstreamRequests.push({ method: req.method ?? '', url: req.url ?? '', headers: req.headers, body: Buffer.concat(chunks) });
      if (req.url === '/v1/accounts' && accountsStatus !== 200) {
        res.writeHead(accountsStatus, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: accountsStatus, message: 'down', data: null }));
      } else if (req.url === '/v1/accounts') {
        res.writeHead(200, { 'content-type': 'application/json', 'x-upstream': 'yes' });
        res.end(JSON.stringify({ status: 200, message: '', data: [{ id: 'acc-1' }, { id: 'acc-2' }] }));
      } else if (req.url === '/v1/accounts/acc-1/templates' && req.method === 'GET') {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 500, message: 'boom', data: null }));
      } else if (req.url?.startsWith('/v1/documents/d1/download/')) {
        res.writeHead(200, { 'content-type': 'application/pdf' });
        res.end(BINARY);
      } else {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 200, message: '', data: { ok: true } }));
      }
    });
  });
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve));
  const address = upstream.address();

  return `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}/v1`;
};

const startSimulator = async (upstreamUrl: string, withApiKey = true) => {
  simulator = createSimulator({
    upstream: upstreamUrl,
    upstreamApiKey: UPSTREAM_KEY,
    accountId: ACCOUNT_ID,
    clientId: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    redirectUri: REDIRECT_URI,
    issuer: ISSUER,
    apiKey: withApiKey ? APP_API_KEY : undefined,
  });
  const { port } = await simulator.listen(0, '127.0.0.1');
  base = `http://127.0.0.1:${port}`;
};

beforeEach(async () => {
  await startSimulator(await startUpstream());
});

afterEach(async () => {
  await simulator.close();
  await new Promise((resolve) => upstream.close(resolve));
});

const pkce = () => {
  const verifier = randomBytes(32).toString('base64url');

  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};

const authorize = async (overrides: Record<string, string> = {}) => {
  const { verifier, challenge } = pkce();
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: ALL_SCOPES,
    state: 'state-1',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    ...overrides,
  });
  const response = await fetch(`${base}/oauth/authorize?${params}`, { redirect: 'manual' });
  const location = response.headers.get('location');

  return { response, verifier, redirect: location ? new URL(location) : null };
};

const post = (path: string, body: Record<string, unknown>, asJson = false) =>
  fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': asJson ? 'application/json' : 'application/x-www-form-urlencoded' },
    body: asJson ? JSON.stringify(body) : new URLSearchParams(body as Record<string, string>).toString(),
  });

const clientAuth = { client_id: CLIENT_ID, client_secret: CLIENT_SECRET };

const exchange = async (code: string, verifier: string, extra: Record<string, string> = {}) =>
  post('/v1/oauth/token', {
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
    ...clientAuth,
    ...extra,
  });

const connect = async (scope = ALL_SCOPES) => {
  const { redirect, verifier } = await authorize({ scope });
  const response = await exchange(redirect?.searchParams.get('code') ?? '', verifier);

  return (await response.json()) as TokenBody;
};

const refresh = (refreshToken: string) =>
  post('/v1/oauth/token', { grant_type: 'refresh_token', refresh_token: refreshToken, ...clientAuth });

const api = (path: string, token: string, init: RequestInit = {}) =>
  fetch(`${base}/v1${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...init.headers } });

const admin = async (method: string, path: string, body?: unknown) => {
  const response = await fetch(`${base}/__sim${path}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  return { status: response.status, body: await response.json() };
};

const grants = async () => (await admin('GET', '/grants')).body.grants;

describe('GET /oauth/authorize', () => {
  it('shows an error page without redirecting for an unknown client or redirect URI', async () => {
    for (const overrides of [{ client_id: 'other' }, { redirect_uri: `${REDIRECT_URI}/` }] as Record<string, string>[]) {
      const { response, redirect } = await authorize(overrides);

      expect(response.status).toBe(400);
      expect(response.headers.get('content-type')).toContain('text/html');
      expect(redirect).toBeNull();
    }
  });

  it.each([
    [{ response_type: 'token' }, 'unsupported_response_type'],
    [{ scope: '' }, 'invalid_scope'],
    [{ scope: 'documents:read webhooks:write' }, 'invalid_scope'],
    [{ code_challenge_method: 'plain' }, 'invalid_request'],
    [{ code_challenge: 'too-short' }, 'invalid_request'],
  ])('redirects %o with error %s', async (overrides, error) => {
    const { response, redirect } = await authorize(overrides);

    expect(response.status).toBe(302);
    expect(redirect?.searchParams.get('error')).toBe(error);
    expect(redirect?.searchParams.get('state')).toBe('state-1');
    expect(redirect?.searchParams.get('iss')).toBe(ISSUER);
    expect(redirect?.searchParams.has('code')).toBe(false);
  });

  it('redirects access_denied when configured to deny', async () => {
    await admin('POST', '/config', { deny: true });

    const { redirect } = await authorize();

    expect(redirect?.searchParams.get('error')).toBe('access_denied');
  });

  it('approves automatically with code, state and iss', async () => {
    const { redirect } = await authorize();

    expect(`${redirect?.origin}${redirect?.pathname}`).toBe(REDIRECT_URI);
    expect(redirect?.searchParams.get('code')).toMatch(/^[\w-]{43}$/);
    expect(redirect?.searchParams.get('state')).toBe('state-1');
    expect(redirect?.searchParams.get('iss')).toBe(ISSUER);
  });
});

describe('POST /v1/oauth/token authorization_code', () => {
  it('issues tokens for a valid exchange without echoing offline_access in scope', async () => {
    const { redirect, verifier } = await authorize();

    const response = await exchange(redirect?.searchParams.get('code') ?? '', verifier);
    const body = (await response.json()) as TokenBody;

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toEqual({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'documents:read documents:write templates:read templates:write account:read',
    });
    expect(await grants()).toEqual([
      {
        id: 'grant_1',
        accountId: ACCOUNT_ID,
        scopes: ALL_SCOPES.split(' '),
        revoked: false,
        refreshCount: 0,
        reuseDetected: false,
      },
    ]);
  });

  it('accepts a JSON body and omits refresh_token without offline_access', async () => {
    const { redirect, verifier } = await authorize({ scope: 'documents:read' });

    const response = await post(
      '/v1/oauth/token',
      {
        grant_type: 'authorization_code',
        code: redirect?.searchParams.get('code'),
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
        ...clientAuth,
      },
      true,
    );
    const body = (await response.json()) as TokenBody;

    expect(body.scope).toBe('documents:read');
    expect(body.refresh_token).toBeUndefined();
  });

  it('grants the configured scopes and access token lifetime', async () => {
    await admin('POST', '/config', { grantedScopes: ['documents:read', 'offline_access'], accessTtlSeconds: 60 });

    const body = await connect();

    expect(body.scope).toBe('documents:read');
    expect(body.expires_in).toBe(60);
    expect(body.refresh_token).toEqual(expect.any(String));
  });

  it.each([
    [{ client_secret: '' }],
    [{ client_secret: 'wrong' }],
    [{ client_id: 'other' }],
  ])('answers 401 invalid_client for %o', async (extra) => {
    const { redirect, verifier } = await authorize();

    const response = await exchange(redirect?.searchParams.get('code') ?? '', verifier, extra);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'invalid_client', error_description: expect.any(String) });
  });

  it('rejects a verifier that does not match the challenge or breaks the grammar', async () => {
    for (const verifier of [pkce().verifier, 'short']) {
      const { redirect } = await authorize();
      const response = await exchange(redirect?.searchParams.get('code') ?? '', verifier);

      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('invalid_grant');
    }
  });

  it('rejects a different redirect_uri, an expired code and an unknown code', async () => {
    const first = await authorize();
    const mismatch = await exchange(first.redirect?.searchParams.get('code') ?? '', first.verifier, {
      redirect_uri: 'http://localhost:2021/other',
    });
    const second = await authorize();
    await admin('POST', '/clock/advance', { seconds: 61 });
    const expired = await exchange(second.redirect?.searchParams.get('code') ?? '', second.verifier);
    const unknown = await exchange('nope', second.verifier);

    for (const response of [mismatch, expired, unknown]) {
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('invalid_grant');
    }
  });

  it('refuses a reused code and ends the grant it produced', async () => {
    const { redirect, verifier } = await authorize();
    const code = redirect?.searchParams.get('code') ?? '';
    const tokens = (await (await exchange(code, verifier)).json()) as TokenBody;

    const replay = await exchange(code, verifier);

    expect(replay.status).toBe(400);
    expect((await replay.json()).error).toBe('invalid_grant');
    expect((await api('/accounts', tokens.access_token)).status).toBe(401);
    expect((await grants())[0].revoked).toBe(true);
  });

  it('answers unsupported_grant_type for other grants', async () => {
    const response = await post('/v1/oauth/token', { grant_type: 'client_credentials', ...clientAuth });

    expect(response.status).toBe(400);
    expect((await response.json()).error).toBe('unsupported_grant_type');
  });
});

describe('POST /v1/oauth/token refresh_token', () => {
  it('rotates the refresh token on every refresh', async () => {
    const first = await connect();

    const response = await refresh(first.refresh_token ?? '');
    const second = (await response.json()) as TokenBody;

    expect(response.status).toBe(200);
    expect(second.refresh_token).toEqual(expect.any(String));
    expect(second.refresh_token).not.toBe(first.refresh_token);
    expect((await api('/accounts', second.access_token)).status).toBe(200);
    expect((await grants())[0].refreshCount).toBe(1);
  });

  it('logs which access-token issuance each API call used', async () => {
    const first = await connect();
    const second = (await (await refresh(first.refresh_token ?? '')).json()) as TokenBody;

    await api('/accounts', first.access_token);
    await api('/accounts', second.access_token);

    const { entries } = (await admin('GET', '/log')).body;
    expect(entries.filter((e: { kind: string }) => e.kind === 'api').map((e: { tokenIndex?: number }) => e.tokenIndex)).toEqual([1, 2]);
  });

  it('ends the whole grant when a retired refresh token is reused', async () => {
    const first = await connect();
    const second = (await (await refresh(first.refresh_token ?? '')).json()) as TokenBody;

    const reuse = await refresh(first.refresh_token ?? '');

    expect(reuse.status).toBe(400);
    expect((await reuse.json()).error).toBe('invalid_grant');
    expect((await api('/accounts', second.access_token)).status).toBe(401);
    expect((await refresh(second.refresh_token ?? '')).status).toBe(400);
    expect(await grants()).toEqual([expect.objectContaining({ revoked: true, reuseDetected: true, refreshCount: 1 })]);
  });

  it('rejects an unknown and an expired refresh token', async () => {
    const tokens = await connect();
    const unknown = await refresh('nope');
    await admin('POST', '/clock/advance', { seconds: 31 * 24 * 3600 });
    const expired = await refresh(tokens.refresh_token ?? '');

    for (const response of [unknown, expired]) {
      expect(response.status).toBe(400);
      expect((await response.json()).error).toBe('invalid_grant');
    }
  });
});

describe('POST /v1/oauth/revoke', () => {
  it('requires client authentication', async () => {
    const response = await post('/v1/oauth/revoke', { token: 'x', client_id: CLIENT_ID });

    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe('invalid_client');
  });

  it('answers 200 for an unknown token', async () => {
    expect((await post('/v1/oauth/revoke', { token: 'unknown', ...clientAuth })).status).toBe(200);
  });

  it('revokes only the access token by default, leaving refresh usable', async () => {
    const tokens = await connect();

    const response = await post('/v1/oauth/revoke', {
      token: tokens.access_token,
      token_type_hint: 'access_token',
      ...clientAuth,
    });

    expect(response.status).toBe(200);
    expect((await api('/accounts', tokens.access_token)).status).toBe(401);
    expect((await refresh(tokens.refresh_token ?? '')).status).toBe(200);
  });

  it('ends the grant on access-token revocation when configured', async () => {
    await admin('POST', '/config', { revokeAccessEndsGrant: true });
    const tokens = await connect();

    await post('/v1/oauth/revoke', { token: tokens.access_token, ...clientAuth });

    expect((await api('/accounts', tokens.access_token)).status).toBe(401);
    expect((await refresh(tokens.refresh_token ?? '')).status).toBe(400);
  });

  it('ends the grant when the refresh token is revoked', async () => {
    const tokens = await connect();

    await post('/v1/oauth/revoke', { token: tokens.refresh_token, token_type_hint: 'refresh_token', ...clientAuth }, true);

    expect((await api('/accounts', tokens.access_token)).status).toBe(401);
    expect((await grants())[0].revoked).toBe(true);
  });
});

describe('/v1 proxy', () => {
  it('swaps the Bearer token for the upstream key and keeps method, path and query', async () => {
    const { access_token } = await connect();

    const response = await api('/documents/d9?expand=assignment', access_token);

    expect(response.status).toBe(200);
    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0]).toMatchObject({ method: 'GET', url: '/v1/documents/d9?expand=assignment' });
    expect(upstreamRequests[0]?.headers['x-api-key']).toBe(UPSTREAM_KEY);
    expect(upstreamRequests[0]?.headers.authorization).toBeUndefined();
  });

  it('filters GET /accounts to the bound workspace for OAuth tokens', async () => {
    const { access_token } = await connect();

    const response = await api('/accounts', access_token);

    expect(await response.json()).toEqual({ status: 200, message: '', data: [{ id: 'acc-1' }] });
  });

  it('passes the app API key through without account filtering', async () => {
    const response = await fetch(`${base}/v1/accounts`, { headers: { 'x-api-key': APP_API_KEY } });

    expect(response.headers.get('x-upstream')).toBe('yes');
    expect((await response.json()).data).toHaveLength(2);
    expect(upstreamRequests[0]?.headers['x-api-key']).toBe(UPSTREAM_KEY);
  });

  it('keeps an upstream error status on /accounts and other routes', async () => {
    const { access_token } = await connect();

    const response = await api('/accounts/acc-1/templates', access_token);

    expect(response.status).toBe(500);
    expect((await response.json()).message).toBe('boom');

    accountsStatus = 503;
    const accounts = await api('/accounts', access_token);

    expect(accounts.status).toBe(503);
    expect((await accounts.json()).message).toBe('down');
  });

  it('answers 401 invalid_token for a missing, unknown, expired or X-Api-Key token', async () => {
    const { access_token } = await connect();
    const missing = await fetch(`${base}/v1/accounts`);
    const unknown = await api('/accounts', 'nope');
    const wrongKey = await fetch(`${base}/v1/accounts`, { headers: { 'x-api-key': access_token } });
    await admin('POST', '/clock/advance', { seconds: 3601 });
    const expired = await api('/accounts', access_token);

    for (const response of [missing, unknown, wrongKey, expired]) {
      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toBe('Bearer error="invalid_token"');
      expect(await response.json()).toEqual({ status: 401, message: expect.any(String), data: null });
    }
    expect(upstreamRequests).toHaveLength(0);
  });

  it('refuses any X-Api-Key when no app API key is configured', async () => {
    await simulator.close();
    await startSimulator('http://127.0.0.1:1/v1', false);

    expect((await fetch(`${base}/v1/accounts`, { headers: { 'x-api-key': APP_API_KEY } })).status).toBe(401);
  });

  it('answers 403 without a challenge for another workspace and unlisted routes', async () => {
    const { access_token } = await connect();

    for (const response of [await api('/accounts/acc-2/documents', access_token), await api('/accounts/acc-1/stats', access_token)]) {
      expect(response.status).toBe(403);
      expect(response.headers.get('www-authenticate')).toBeNull();
    }
    expect(upstreamRequests).toHaveLength(0);
  });

  it('answers 403 insufficient_scope naming the missing scope', async () => {
    await admin('POST', '/config', { grantedScopes: ['documents:read', 'documents:write', 'templates:read'] });
    const { access_token } = await connect();

    const response = await api('/accounts/acc-1/templates/t1/documents', access_token, { method: 'POST', body: '{}' });

    expect(response.status).toBe(403);
    expect(response.headers.get('www-authenticate')).toBe('Bearer error="insufficient_scope", scope="templates:write"');
    expect((await api('/accounts/acc-1/templates', access_token)).status).toBe(500);
    expect(upstreamRequests).toHaveLength(1);
  });

  it('streams a multipart upload with its headers', async () => {
    const { access_token } = await connect();
    const form = new FormData();
    form.append('file', new Blob([BINARY], { type: 'application/pdf' }), 'contrato.pdf');
    const request = new Request(`${base}/v1/accounts/acc-1/documents`, { method: 'POST', body: form });
    const payload = Buffer.from(await request.clone().arrayBuffer());

    const response = await api('/accounts/acc-1/documents', access_token, {
      method: 'POST',
      headers: { 'content-type': request.headers.get('content-type') ?? '', 'content-length': String(payload.length) },
      body: payload,
    });

    expect(response.status).toBe(200);
    expect(upstreamRequests[0]?.headers['content-type']).toMatch(/^multipart\/form-data; boundary=/);
    expect(upstreamRequests[0]?.headers['content-length']).toBe(String(payload.length));
    expect(upstreamRequests[0]?.body.equals(payload)).toBe(true);
  });

  it('streams a binary download unchanged', async () => {
    const { access_token } = await connect();

    const response = await api('/documents/d1/download/certificated', access_token);

    expect(response.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await response.arrayBuffer()).equals(BINARY)).toBe(true);
  });

  it('answers 502 when the upstream cannot be reached', async () => {
    await simulator.close();
    await startSimulator('http://127.0.0.1:1/v1');

    const response = await fetch(`${base}/v1/accounts`, { headers: { 'x-api-key': APP_API_KEY } });

    expect(response.status).toBe(502);
  });

  it('answers 404 outside the proxied API', async () => {
    expect((await fetch(`${base}/v1/oauth/userinfo`)).status).toBe(404);
    expect((await fetch(`${base}/other`)).status).toBe(404);
  });
});

describe('fault injection', () => {
  it('answers a before fault without calling upstream, for the configured number of times', async () => {
    const { access_token } = await connect();
    await admin('POST', '/faults', {
      rules: [
        {
          method: 'get',
          pathRegex: '^/v1/documents/',
          times: 1,
          phase: 'before',
          action: { status: 429, retryAfter: 2, scopeChallenge: 'documents:read' },
        },
      ],
    });

    const faulted = await api('/documents/d2', access_token);
    const next = await api('/documents/d2', access_token);

    expect(faulted.status).toBe(429);
    expect(faulted.headers.get('retry-after')).toBe('2');
    expect(faulted.headers.get('www-authenticate')).toBe('Bearer error="insufficient_scope", scope="documents:read"');
    expect(await faulted.json()).toEqual({ status: 429, message: 'Simulated fault', data: null });
    expect(next.status).toBe(200);
    expect(upstreamRequests).toHaveLength(1);
  });

  it('ignores rules for another method and stops after DELETE /__sim/faults', async () => {
    const { access_token } = await connect();
    await admin('POST', '/faults', { rules: [{ method: 'POST', pathRegex: '/documents/', phase: 'before', action: { status: 500 } }] });

    expect((await api('/documents/d2', access_token)).status).toBe(200);
    await admin('DELETE', '/faults');
    expect((await api('/documents/d2', access_token, { method: 'POST', body: '{}' })).status).toBe(200);
  });

  it('forwards upstream first for an after fault, then answers the fault', async () => {
    const { access_token } = await connect();
    await admin('POST', '/faults', {
      rules: [{ pathRegex: '/assignments$', phase: 'after', action: { status: 503, body: { status: 503, message: 'x', data: null } } }],
    });

    const response = await api('/documents/d3/assignments', access_token, { method: 'POST', body: '{"signers":[]}' });

    expect(response.status).toBe(503);
    expect(upstreamRequests).toHaveLength(1);
    expect(upstreamRequests[0]?.body.toString()).toBe('{"signers":[]}');
    const { entries } = (await admin('GET', '/log')).body;
    expect(entries.find((entry: { path: string }) => entry.path === '/v1/documents/d3/assignments')).toMatchObject({
      status: 503,
      kind: 'api',
      fault: 'after:503',
    });
  });

  it('delays before and after forwarding', async () => {
    const { access_token } = await connect();
    await admin('POST', '/faults', {
      rules: [
        { pathRegex: '/d4$', times: 1, phase: 'before', action: { delayMs: 150 } },
        { pathRegex: '/d4$', times: 1, phase: 'after', action: { delayMs: 150 } },
      ],
    });

    for (let run = 0; run < 2; run += 1) {
      const started = Date.now();
      const response = await api('/documents/d4', access_token);

      expect(response.status).toBe(200);
      expect(Date.now() - started).toBeGreaterThanOrEqual(140);
    }
    expect(upstreamRequests).toHaveLength(2);
  });

  it('resets the connection before or after forwarding', async () => {
    const { access_token } = await connect();
    await admin('POST', '/faults', {
      rules: [
        { pathRegex: '/d5$', times: 1, phase: 'before', action: { reset: true } },
        { pathRegex: '/d5$', times: 1, phase: 'after', action: { reset: true } },
      ],
    });

    await expect(api('/documents/d5', access_token)).rejects.toThrow('fetch failed');
    expect(upstreamRequests).toHaveLength(0);
    await expect(api('/documents/d5', access_token)).rejects.toThrow('fetch failed');
    expect(upstreamRequests).toHaveLength(1);
    expect((await admin('GET', '/log')).body.entries.filter((e: { fault?: string }) => e.fault)).toEqual([
      expect.objectContaining({ fault: 'before:reset', status: 0 }),
      expect.objectContaining({ fault: 'after:reset', status: 0 }),
    ]);
  });

  it('applies to the token endpoint: a refresh rotated behind a failed answer makes a retry look like reuse', async () => {
    const tokens = await connect();
    await admin('POST', '/faults', { rules: [{ pathRegex: '^/v1/oauth/token$', times: 1, phase: 'after', action: { status: 503 } }] });

    expect((await refresh(tokens.refresh_token ?? '')).status).toBe(503);
    expect((await refresh(tokens.refresh_token ?? '')).status).toBe(400);
    expect(await grants()).toEqual([expect.objectContaining({ refreshCount: 1, revoked: true, reuseDetected: true })]);
  });
});

describe('admin endpoints', () => {
  it('reports health', async () => {
    expect(await admin('GET', '/health')).toEqual({ status: 200, body: { ok: true } });
  });

  it('revokes a grant like the user would under Connected apps', async () => {
    const { access_token } = await connect();

    expect((await admin('POST', '/grants/grant_1/revoke')).status).toBe(200);
    expect((await admin('POST', '/grants/grant_9/revoke')).status).toBe(404);
    expect((await api('/accounts', access_token)).status).toBe(401);
  });

  it('resets grants, config, faults and the log', async () => {
    await admin('POST', '/config', { deny: true });
    await admin('POST', '/faults', { rules: [{ pathRegex: '.', phase: 'before', action: { status: 500 } }] });
    await admin('POST', '/reset');

    const { redirect } = await authorize();

    expect(redirect?.searchParams.get('code')).toEqual(expect.any(String));
    expect(await grants()).toEqual([]);
    expect((await admin('GET', '/log')).body.entries.map((e: { kind: string }) => e.kind)).toEqual(['admin', 'authorize', 'admin']);
  });

  it('logs every request kind without token, secret or key values', async () => {
    const tokens = await connect();
    await refresh(tokens.refresh_token ?? '');
    await api('/accounts', tokens.access_token);
    await post('/v1/oauth/token', { grant_type: 'password', ...clientAuth });
    await post('/v1/oauth/revoke', { token: tokens.access_token, token_type_hint: 'weird', ...clientAuth });

    const { entries } = (await admin('GET', '/log')).body;

    expect(entries.map((e: { kind: string; status: number }) => `${e.kind}:${e.status}`)).toEqual([
      'authorize:302',
      'token:200',
      'token:200',
      'api:200',
      'token:400',
      'revoke:200',
    ]);
    expect(entries[1]).toMatchObject({ grantType: 'authorization_code', grantId: 'grant_1', method: 'POST' });
    expect(entries[2]).toMatchObject({ grantType: 'refresh_token', grantId: 'grant_1' });
    expect(entries[3]).toMatchObject({ grantId: 'grant_1', path: '/v1/accounts' });
    expect(entries[4]).toMatchObject({ grantType: 'other' });
    expect(entries[5]).toMatchObject({ tokenTypeHint: 'other', grantId: 'grant_1' });
    expect(entries[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const serialized = JSON.stringify(entries);
    for (const secret of [tokens.access_token, tokens.refresh_token ?? '', CLIENT_SECRET, UPSTREAM_KEY, APP_API_KEY]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('answers 404 for an unknown admin route and 500 for a malformed body', async () => {
    expect((await admin('GET', '/nope')).status).toBe(404);
    const response = await fetch(`${base}/v1/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });

    expect(response.status).toBe(500);
  });
});

describe('createSimulator', () => {
  it('requires its connection options', () => {
    expect(() => createSimulator({} as Parameters<typeof createSimulator>[0])).toThrow('upstream is required');
  });

  it('rejects listen when the port is taken', async () => {
    const address = simulator.server.address();
    const other = createSimulator({
      upstream: 'http://127.0.0.1:1/v1',
      upstreamApiKey: UPSTREAM_KEY,
      accountId: ACCOUNT_ID,
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUri: REDIRECT_URI,
      issuer: ISSUER,
    });

    await expect(other.listen(typeof address === 'object' && address ? address.port : 0, '127.0.0.1')).rejects.toThrow('EADDRINUSE');
  });
});

const run = (env: Record<string, string>) =>
  spawn(process.execPath, [SIMULATOR_PATH], { env: { PATH: process.env.PATH ?? '', ...env } });

describe('command line', () => {
  it('starts from environment variables and never prints the upstream key', async () => {
    const child = run({
      SIM_PORT: '0',
      SIM_HOST: '127.0.0.1',
      SIM_UPSTREAM_API_KEY: UPSTREAM_KEY,
      SIM_ACCOUNT_ID: ACCOUNT_ID,
      SIM_CLIENT_ID: CLIENT_ID,
      SIM_CLIENT_SECRET: CLIENT_SECRET,
    });
    const line = await new Promise<string>((resolve) => child.stdout.once('data', (chunk: Buffer) => resolve(chunk.toString())));
    const exited = new Promise((resolve) => child.once('exit', resolve));
    const url = /listening on (\S+)/.exec(line)?.[1] ?? '';

    expect((await fetch(`${url}/__sim/health`)).status).toBe(200);
    expect(line).not.toContain(UPSTREAM_KEY);
    child.kill('SIGTERM');
    expect(await exited).toBe(0);
  });

  it('exits with an error without the upstream key', async () => {
    const child = run({});

    expect(await new Promise((resolve) => child.once('exit', resolve))).toBe(1);
  });
});
