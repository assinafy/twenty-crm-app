// Local stand-in for Assinafy used by the end-to-end suite: an auto-approving OAuth server plus a /v1 proxy that
// swaps simulator-issued Bearer tokens for the sandbox API key. Zero dependencies so it can run inside the Twenty
// test container with `node assinafy-simulator.mjs`.
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';

// The scopes the app's connection provider requests (src/constants/assinafy.ts).
const APP_SCOPES = [
  'documents:read',
  'documents:write',
  'templates:read',
  'templates:write',
  'account:read',
  'offline_access',
];
const CODE_TTL_MS = 60_000;
const REFRESH_TTL_MS = 30 * 24 * 3600_000;
const MAX_FORM_BYTES = 1_000_000;
const DEFAULT_CONFIG = { deny: false, grantedScopes: null, accessTtlSeconds: 3600, revokeAccessEndsGrant: true };
const KNOWN_GRANT_TYPES = ['authorization_code', 'refresh_token'];
const KNOWN_HINTS = ['access_token', 'refresh_token'];
// Request headers worth forwarding upstream; credentials and hop-by-hop headers are rebuilt or dropped.
const FORWARDED_REQUEST_HEADERS = ['accept', 'content-type', 'content-length', 'user-agent'];
// fetch decodes compressed bodies and Node re-frames the response, so these upstream headers no longer apply.
const DROPPED_RESPONSE_HEADERS = ['content-encoding', 'content-length', 'transfer-encoding', 'connection', 'keep-alive'];

// Ordered route table: the first match gives the scopes a Bearer token needs. Assinafy does not publish per-route
// scopes; this follows the scope descriptions in the OAuth guide. Unlisted routes are areas apps cannot use.
const SCOPE_ROUTES = [
  { methods: /^GET$/, path: /^\/accounts$/, scopes: [] },
  {
    methods: /^POST$/,
    path: /^\/accounts\/[^/]+\/templates\/[^/]+\/documents(\/estimate-cost)?$/,
    scopes: ['templates:write', 'documents:write'],
  },
  { methods: /^GET$/, path: /^\/accounts\/[^/]+\/templates(\/.*)?$/, scopes: ['templates:read'] },
  { methods: /^(POST|PUT|PATCH|DELETE)$/, path: /^\/accounts\/[^/]+\/templates(\/.*)?$/, scopes: ['templates:write'] },
  { methods: /^GET$/, path: /^(\/accounts\/[^/]+)?\/(documents|signers)(\/.*)?$/, scopes: ['documents:read'] },
  {
    methods: /^(POST|PUT|PATCH|DELETE)$/,
    path: /^(\/accounts\/[^/]+)?\/(documents|signers)(\/.*)?$/,
    scopes: ['documents:write'],
  },
  { methods: /^GET$/, path: /^\/accounts\/[^/]+(\/(theme|logo))?$/, scopes: ['account:read'] },
];

const newToken = () => randomBytes(32).toString('base64url');
const sha256Base64Url = (value) => createHash('sha256').update(value).digest('base64url');
const sameSecret = (given, expected) => {
  const a = Buffer.from(String(given ?? ''));
  const b = Buffer.from(expected);

  return a.length === b.length && timingSafeEqual(a, b);
};
const json = (status, body, headers = {}) => ({
  status,
  headers: { 'content-type': 'application/json', ...headers },
  body: JSON.stringify(body),
});
const apiError = (status, message, headers) => json(status, { status, message, data: null }, headers);
const oauthError = (status, error, description) =>
  json(status, { error, error_description: description }, { 'cache-control': 'no-store' });

const readBody = async (req) => {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_FORM_BYTES) throw new Error('body too large');
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
};

// OAuth endpoints accept form-encoded or JSON bodies; admin endpoints send JSON.
const parseParams = async (req) => {
  const text = await readBody(req);

  if (String(req.headers['content-type'] ?? '').includes('application/json')) {
    const parsed = text ? JSON.parse(text) : {};

    return parsed && typeof parsed === 'object' ? parsed : {};
  }

  return Object.fromEntries(new URLSearchParams(text));
};

// Discards an upstream body the fault replaces.
const drain = async (reply) => {
  if (reply?.body && typeof reply.body !== 'string') await new Response(reply.body).arrayBuffer();
};

const endGrant = (grant, reuseDetected = false) => {
  grant.revoked = true;
  grant.reuseDetected ||= reuseDetected;
};

// An OAuth connection sees only the workspace it was granted.
const filterAccounts = async (reply, accountId) => {
  if (reply.status !== 200) return reply;
  const payload = await new Response(reply.body).json();
  payload.data = payload.data.filter((account) => account.id === accountId);

  return json(200, payload);
};

const invalidToken = () =>
  apiError(401, 'Invalid or expired access token', { 'www-authenticate': 'Bearer error="invalid_token"' });

const faultReply = (action) => {
  const headers = {};
  if (action.scopeChallenge) {
    headers['www-authenticate'] = `Bearer error="insufficient_scope", scope="${action.scopeChallenge}"`;
  }
  if (action.retryAfter !== undefined) headers['retry-after'] = String(action.retryAfter);

  return json(action.status, action.body ?? { status: action.status, message: 'Simulated fault', data: null }, headers);
};

const send = async (res, reply) => {
  res.writeHead(reply.status, reply.headers);
  if (reply.body === undefined || typeof reply.body === 'string') {
    res.end(reply.body);

    return;
  }
  try {
    for await (const chunk of reply.body) res.write(chunk);
  } finally {
    res.end();
  }
};

export const createSimulator = (options) => {
  for (const name of ['upstream', 'upstreamApiKey', 'accountId', 'clientId', 'clientSecret', 'redirectUri', 'issuer']) {
    if (!options?.[name]) throw new Error(`createSimulator: ${name} is required`);
  }
  const upstream = options.upstream.replace(/\/+$/, '');

  let state;
  const resetState = () => {
    state = {
      clockOffsetMs: 0,
      config: { ...DEFAULT_CONFIG },
      codes: new Map(),
      grants: new Map(),
      accessTokens: new Map(),
      refreshTokens: new Map(),
      faults: [],
      log: [],
    };
  };
  resetState();

  const now = () => Date.now() + state.clockOffsetMs;

  const issueTokens = (grant) => {
    const accessToken = newToken();
    state.accessTokens.set(accessToken, {
      grantId: grant.id,
      // Which issuance of the grant this is (1 for the code exchange, then one per refresh), logged on each API call.
      index: (grant.issued += 1),
      expiresAt: now() + state.config.accessTtlSeconds * 1000,
      revoked: false,
    });
    const body = {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: state.config.accessTtlSeconds,
      scope: grant.scopes.filter((scope) => scope !== 'offline_access').join(' '),
    };
    if (grant.scopes.includes('offline_access')) {
      body.refresh_token = newToken();
      state.refreshTokens.set(body.refresh_token, { grantId: grant.id, expiresAt: now() + REFRESH_TTL_MS, used: false });
    }

    return json(200, body, { 'cache-control': 'no-store', pragma: 'no-cache' });
  };

  const authorize = (url) => {
    const params = url.searchParams;
    if (params.get('client_id') !== options.clientId || params.get('redirect_uri') !== options.redirectUri) {
      return {
        status: 400,
        headers: { 'content-type': 'text/html; charset=utf-8' },
        body: '<!doctype html><title>Assinafy</title><p>Aplicativo ou endereço de retorno inválido.</p>',
      };
    }
    const back = new URL(options.redirectUri);
    const redirect = (values) => {
      for (const [key, value] of Object.entries({ ...values, state: params.get('state'), iss: options.issuer })) {
        if (value !== null) back.searchParams.set(key, value);
      }

      return { status: 302, headers: { location: back.href } };
    };
    const requested = (params.get('scope') ?? '').split(' ').filter(Boolean);

    if (params.get('response_type') !== 'code') {
      return redirect({ error: 'unsupported_response_type', error_description: 'Only response_type=code is supported' });
    }
    if (requested.length === 0 || requested.some((scope) => !APP_SCOPES.includes(scope))) {
      return redirect({ error: 'invalid_scope', error_description: 'Requested scope is not registered' });
    }
    if (
      params.get('code_challenge_method') !== 'S256' ||
      !/^[A-Za-z0-9_-]{43}$/.test(params.get('code_challenge') ?? '')
    ) {
      return redirect({ error: 'invalid_request', error_description: 'PKCE S256 code_challenge is required' });
    }
    if (state.config.deny) {
      return redirect({ error: 'access_denied', error_description: 'The user declined' });
    }
    const code = newToken();
    state.codes.set(code, {
      challenge: params.get('code_challenge'),
      redirectUri: params.get('redirect_uri'),
      scopes: state.config.grantedScopes ?? requested,
      expiresAt: now() + CODE_TTL_MS,
      grantId: null,
    });

    return redirect({ code });
  };

  const exchangeCode = (params) => {
    const code = state.codes.get(String(params.code ?? ''));
    if (!code) return oauthError(400, 'invalid_grant', 'Unknown authorization code');
    if (code.grantId) {
      // A replayed code ends the grant it produced.
      endGrant(state.grants.get(code.grantId));

      return { reply: oauthError(400, 'invalid_grant', 'Authorization code already used'), grantId: code.grantId };
    }
    if (now() > code.expiresAt) return oauthError(400, 'invalid_grant', 'Authorization code expired');
    if (params.redirect_uri !== code.redirectUri) return oauthError(400, 'invalid_grant', 'redirect_uri mismatch');
    const verifier = String(params.code_verifier ?? '');
    if (!/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier) || sha256Base64Url(verifier) !== code.challenge) {
      return oauthError(400, 'invalid_grant', 'code_verifier does not match');
    }
    const grant = {
      id: `grant_${state.grants.size + 1}`,
      accountId: options.accountId,
      scopes: code.scopes,
      revoked: false,
      refreshCount: 0,
      reuseDetected: false,
      issued: 0,
    };
    state.grants.set(grant.id, grant);
    code.grantId = grant.id;

    return { reply: issueTokens(grant), grantId: grant.id };
  };

  const refresh = (params) => {
    const record = state.refreshTokens.get(String(params.refresh_token ?? ''));
    if (!record) return oauthError(400, 'invalid_grant', 'Unknown refresh token');
    const grant = state.grants.get(record.grantId);
    const fail = (description) => ({ reply: oauthError(400, 'invalid_grant', description), grantId: grant.id });
    if (record.used) {
      endGrant(grant, true);

      return fail('Refresh token already used; the connection was ended');
    }
    if (grant.revoked) return fail('The connection was revoked');
    if (now() > record.expiresAt) return fail('Refresh token expired');
    record.used = true;
    grant.refreshCount += 1;

    return { reply: issueTokens(grant), grantId: grant.id };
  };

  const token = async (req, entry) => {
    const params = await parseParams(req);
    entry.grantType = KNOWN_GRANT_TYPES.includes(params.grant_type) ? params.grant_type : 'other';
    if (params.client_id !== options.clientId || !sameSecret(params.client_secret, options.clientSecret)) {
      return oauthError(401, 'invalid_client', 'Client authentication failed');
    }
    const outcome =
      params.grant_type === 'authorization_code'
        ? exchangeCode(params)
        : params.grant_type === 'refresh_token'
          ? refresh(params)
          : oauthError(400, 'unsupported_grant_type', 'Only authorization_code and refresh_token are supported');
    if (!('reply' in outcome)) return outcome;
    entry.grantId = outcome.grantId;

    return outcome.reply;
  };

  const revoke = async (req, entry) => {
    const params = await parseParams(req);
    if (params.token_type_hint !== undefined) {
      entry.tokenTypeHint = KNOWN_HINTS.includes(params.token_type_hint) ? params.token_type_hint : 'other';
    }
    if (params.client_id !== options.clientId || !sameSecret(params.client_secret, options.clientSecret)) {
      return oauthError(401, 'invalid_client', 'Client authentication failed');
    }
    const value = String(params.token ?? '');
    const access = state.accessTokens.get(value);
    const refreshRecord = state.refreshTokens.get(value);
    if (access) {
      access.revoked = true;
      entry.grantId = access.grantId;
      if (state.config.revokeAccessEndsGrant) endGrant(state.grants.get(access.grantId));
    } else if (refreshRecord) {
      entry.grantId = refreshRecord.grantId;
      endGrant(state.grants.get(refreshRecord.grantId));
    }

    return { status: 200, headers: { 'cache-control': 'no-store' } };
  };

  const forward = async (req, apiPath, search) => {
    const headers = { 'x-api-key': options.upstreamApiKey };
    for (const name of FORWARDED_REQUEST_HEADERS) {
      if (req.headers[name] !== undefined) headers[name] = req.headers[name];
    }
    const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
    let response;
    try {
      response = await fetch(`${upstream}${apiPath}${search}`, {
        method: req.method,
        headers,
        body: hasBody ? req : undefined,
        duplex: hasBody ? 'half' : undefined,
        redirect: 'manual',
      });
    } catch {
      return apiError(502, 'Upstream request failed');
    }
    const replyHeaders = {};
    for (const [name, value] of response.headers) {
      if (!DROPPED_RESPONSE_HEADERS.includes(name)) replyHeaders[name] = value;
    }

    return { status: response.status, headers: replyHeaders, body: response.body ?? undefined };
  };

  const api = async (req, url, entry) => {
    const apiPath = url.pathname.slice('/v1'.length);
    const authorization = String(req.headers.authorization ?? '');
    const apiKey = req.headers['x-api-key'];

    if (!authorization.startsWith('Bearer ')) {
      if (options.apiKey && apiKey !== undefined && sameSecret(apiKey, options.apiKey)) {
        return forward(req, apiPath, url.search);
      }

      return invalidToken();
    }
    const access = state.accessTokens.get(authorization.slice('Bearer '.length));
    const grant = access && state.grants.get(access.grantId);
    if (!access || access.revoked || grant.revoked || now() > access.expiresAt) return invalidToken();
    entry.grantId = grant.id;
    entry.tokenIndex = access.index;

    const accountInPath = /^\/accounts\/([^/]+)/.exec(apiPath)?.[1];
    // Only /accounts/{id} paths are bound to the workspace: /documents/{id} of another workspace is forwarded because
    // the proxy does not look up document ownership.
    if (accountInPath !== undefined && decodeURIComponent(accountInPath) !== grant.accountId) {
      return apiError(403, 'This connection cannot access that workspace');
    }
    const route = SCOPE_ROUTES.find((r) => r.methods.test(req.method) && r.path.test(apiPath));
    if (!route) return apiError(403, 'This area is not available to applications');
    const missing = route.scopes.filter((scope) => !grant.scopes.includes(scope));
    if (missing.length > 0) {
      return apiError(403, 'Insufficient scope', {
        'www-authenticate': `Bearer error="insufficient_scope", scope="${missing.join(' ')}"`,
      });
    }
    const reply = await forward(req, apiPath, url.search);

    return req.method === 'GET' && apiPath === '/accounts' ? filterAccounts(reply, grant.accountId) : reply;
  };

  const admin = async (req, url) => {
    const route = `${req.method} ${url.pathname}`;
    const grantRevoke = /^POST \/__sim\/grants\/([^/]+)\/revoke$/.exec(route);
    const body = req.method === 'POST' ? await parseParams(req) : {};

    if (route === 'GET /__sim/health') return json(200, { ok: true });
    if (route === 'POST /__sim/reset') {
      resetState();

      return json(200, { ok: true });
    }
    if (route === 'POST /__sim/config') {
      for (const key of Object.keys(DEFAULT_CONFIG)) {
        if (key in body) state.config[key] = body[key];
      }

      return json(200, state.config);
    }
    if (route === 'POST /__sim/clock/advance') {
      state.clockOffsetMs += Number(body.seconds) * 1000;

      return json(200, { now: new Date(now()).toISOString() });
    }
    if (route === 'GET /__sim/grants') {
      return json(200, {
        grants: [...state.grants.values()].map(({ id, accountId, scopes, revoked, refreshCount, reuseDetected }) => ({
          id,
          accountId,
          scopes,
          revoked,
          refreshCount,
          reuseDetected,
        })),
      });
    }
    if (grantRevoke) {
      const grant = state.grants.get(decodeURIComponent(grantRevoke[1]));
      if (!grant) return json(404, { ok: false });
      endGrant(grant);

      return json(200, { ok: true });
    }
    if (route === 'GET /__sim/log') return json(200, { entries: state.log });
    if (route === 'POST /__sim/faults') {
      const rules = Array.isArray(body.rules) ? body.rules : [];
      for (const rule of rules) {
        state.faults.push({
          method: rule.method,
          phase: rule.phase === 'after' ? 'after' : 'before',
          action: rule.action ?? {},
          pattern: new RegExp(rule.pathRegex),
          remaining: rule.times ?? Infinity,
        });
      }

      return json(200, { count: state.faults.length });
    }
    if (route === 'DELETE /__sim/faults') {
      state.faults = [];

      return json(200, { count: 0 });
    }

    return json(404, { ok: false });
  };

  const takeFault = (method, pathname) => {
    const rule = state.faults.find(
      (r) => r.remaining > 0 && (!r.method || r.method.toUpperCase() === method) && r.pattern.test(pathname),
    );
    if (rule) rule.remaining -= 1;

    return rule;
  };

  const route = (req, url, entry) => {
    const path = url.pathname;
    if (req.method === 'GET' && path === '/oauth/authorize') {
      entry.kind = 'authorize';

      return authorize(url);
    }
    if (req.method === 'POST' && path === '/v1/oauth/token') {
      entry.kind = 'token';

      return token(req, entry);
    }
    if (req.method === 'POST' && path === '/v1/oauth/revoke') {
      entry.kind = 'revoke';

      return revoke(req, entry);
    }
    if (path.startsWith('/v1/') && !path.startsWith('/v1/oauth/')) return api(req, url, entry);

    return apiError(404, 'Not found');
  };

  const handle = async (req, res) => {
    const url = new URL(req.url, 'http://simulator.invalid');
    const entry = { at: new Date(now()).toISOString(), method: req.method, path: url.pathname, status: 0, kind: 'api' };

    try {
      if (url.pathname.startsWith('/__sim/')) {
        entry.kind = 'admin';
        const reply = await admin(req, url);
        entry.status = reply.status;
        await send(res, reply);

        return;
      }
      const fault = takeFault(req.method, url.pathname);
      const action = fault?.action ?? {};
      if (fault) entry.fault = `${fault.phase}:${action.reset ? 'reset' : action.delayMs !== undefined ? 'delay' : action.status}`;
      const pause = () => new Promise((resolve) => setTimeout(resolve, action.delayMs).unref());

      if (fault?.phase === 'before' && action.delayMs !== undefined) await pause();
      if (fault?.phase === 'before' && action.reset) {
        req.socket.destroy();

        return;
      }
      if (fault?.phase === 'before' && action.status !== undefined) {
        const reply = faultReply(action);
        entry.status = reply.status;
        await send(res, reply);

        return;
      }
      let reply = await route(req, url, entry);
      if (fault?.phase === 'after') {
        if (action.delayMs !== undefined) {
          await pause();
        } else {
          await drain(reply);
          if (action.reset) {
            req.socket.destroy();

            return;
          }
          reply = faultReply(action);
        }
      }
      entry.status = reply.status;
      await send(res, reply);
    } catch (error) {
      console.error(`assinafy-simulator: request failed (${error?.name ?? 'Error'})`);
      entry.status = 500;
      if (!res.headersSent) await send(res, apiError(500, 'Simulator error'));
      else res.destroy();
    } finally {
      state.log.push(entry);
    }
  };

  const server = createServer((req, res) => {
    void handle(req, res);
  });

  return {
    server,
    listen: (port, host) =>
      new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve({ port: server.address().port });
        });
      }),
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
        server.closeAllConnections();
      }),
  };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const env = process.env;
  if (!env.SIM_UPSTREAM_API_KEY) {
    console.error('assinafy-simulator: SIM_UPSTREAM_API_KEY is required');
    process.exit(1);
  }
  const port = Number(env.SIM_PORT ?? 4010);
  const host = env.SIM_HOST ?? '127.0.0.1';
  const simulator = createSimulator({
    upstream: env.SIM_UPSTREAM ?? 'https://sandbox.assinafy.com.br/v1',
    upstreamApiKey: env.SIM_UPSTREAM_API_KEY,
    accountId: env.SIM_ACCOUNT_ID,
    clientId: env.SIM_CLIENT_ID,
    clientSecret: env.SIM_CLIENT_SECRET,
    redirectUri: env.SIM_REDIRECT_URI ?? 'http://localhost:2021/auth/apps/callback',
    apiKey: env.SIM_API_KEY,
    issuer: env.SIM_ISSUER ?? 'http://localhost:4010',
  });
  const { port: bound } = await simulator.listen(port, host);
  process.stdout.write(`assinafy-simulator listening on http://${host}:${bound}\n`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => void simulator.close().then(() => process.exit(0)));
}
