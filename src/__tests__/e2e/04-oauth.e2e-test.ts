import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { E2E_SIGNER, findSendableTemplate, SENDABLE_TEMPLATE_MISSING, sendPdf } from 'src/__tests__/e2e/e2e-flows';
import {
  clearApiKey,
  type ConnectedAccount,
  connectAssinafy,
  deleteConnectedAccount,
  type E2eApp,
  findE2eApp,
  frontEndToken,
  listConnectedAccounts,
  runHealthCheck,
} from 'src/__tests__/e2e/e2e-twenty';
import { graphql } from 'src/__tests__/e2e/graphql';
import { psql } from 'src/__tests__/e2e/psql';
import { setRegistrationVariable } from 'src/__tests__/e2e/registration-variables';
import { type SimLogEntry, simulator } from 'src/__tests__/e2e/simulator-client';
import { createCrmFixtures, type CrmFixtures } from 'src/__tests__/integration/crm-fixtures';
import { callRoute, runCleanup } from 'src/__tests__/integration/twenty-api';
import { ASSINAFY_CLIENT_ID_VARIABLE, ASSINAFY_CLIENT_SECRET_VARIABLE, ASSINAFY_OAUTH_SCOPES } from 'src/constants/assinafy';
import { type DocumentSummary } from 'src/types/document-summary';
import { type SignatureContext } from 'src/types/signature-context';

const cleanup: Array<() => Promise<unknown>> = [];
let app: E2eApp;
let crm: CrmFixtures;
let token: string;

// The grant the simulator issued for a connection, read from its authorization_code exchange.
const grantOf = (entries: SimLogEntry[]): string => {
  const exchange = entries.find(({ kind, grantType }) => kind === 'token' && grantType === 'authorization_code');
  return exchange?.grantId ?? '';
};

const connect = async (visibility: 'user' | 'workspace') => {
  const mark = await simulator.mark();
  const account = await connectAssinafy(app, visibility);
  const log = await simulator.logSince(mark);
  return { account, grantId: grantOf(log), log };
};

// Connects while the simulator grants only `scopes`, whatever Twenty requests.
const connectWithScopes = async (scopes: string[]) => {
  await simulator.configure({ grantedScopes: scopes });
  try {
    return await connect('user');
  } finally {
    await simulator.configure({ grantedScopes: null });
  }
};

const findAccount = async (id: string): Promise<ConnectedAccount | undefined> =>
  (await listConnectedAccounts(app)).find((account) => account.id === id);

// Deletes the connection as the Settings page does and returns the revoke calls the disconnect hook made.
const disconnect = async (id: string) => {
  const mark = await simulator.mark();
  await deleteConnectedAccount(id);
  return (await simulator.logSince(mark)).filter(({ kind }) => kind === 'revoke');
};

let personal: Awaited<ReturnType<typeof connect>>;
let shared: Awaited<ReturnType<typeof connect>>;
let partial: Awaited<ReturnType<typeof connect>>;
let narrowed: Awaited<ReturnType<typeof connect>>;
let revoked: Awaited<ReturnType<typeof connect>>;
let refreshRefused: Awaited<ReturnType<typeof connect>>;

beforeAll(async () => {
  app = await findE2eApp();
  crm = await createCrmFixtures(cleanup);
  token = await frontEndToken(app);
  await clearApiKey(app);
  await setRegistrationVariable(ASSINAFY_CLIENT_ID_VARIABLE, inject('simClientId'));
  await setRegistrationVariable(ASSINAFY_CLIENT_SECRET_VARIABLE, inject('simClientSecret'));
});

afterAll(async () => {
  await simulator.configure({ grantedScopes: null });
  for (const { id } of await listConnectedAccounts(app).catch(() => [])) await deleteConnectedAccount(id).catch(() => undefined);
  await runCleanup(cleanup);
});

describe('OAuth connections through the simulator', () => {
  it('the OAuth client is configured on the registration', async () => {
    const { applicationConnectionProviders } = await graphql<{
      applicationConnectionProviders: Array<{ oauth: { isClientCredentialsConfigured: boolean } }>;
    }>('metadata', 'query ($id: UUID!) { applicationConnectionProviders(applicationId: $id) { oauth { isClientCredentialsConfigured } } }', {
      id: app.id,
    });
    expect(applicationConnectionProviders).toEqual([{ oauth: { isClientCredentialsConfigured: true } }]);
  });

  it('connects a personal connection with an authorization code, client authentication and PKCE', async () => {
    personal = await connect('user');

    // The simulator approves only an S256 challenge and exchanges the code only with the client secret in the body
    // and the matching verifier, so these two successes prove the request shape Twenty sent.
    expect(personal.log.map(({ kind, status, grantType }) => ({ kind, status, grantType }))).toEqual([
      { kind: 'authorize', status: 302, grantType: undefined },
      { kind: 'token', status: 200, grantType: 'authorization_code' },
    ]);
    expect(personal.grantId).toMatch(/^grant_\d+$/);
    expect(personal.account).toMatchObject({
      visibility: 'user',
      scopes: ASSINAFY_OAUTH_SCOPES.filter((scope) => scope !== 'offline_access'),
      lastCredentialsRefreshedAt: expect.any(String),
      authFailedAt: null,
    });
  });

  it('/context and a send use the personal connection', async () => {
    const context = await callRoute<SignatureContext>('/s/assinafy/context', token, { recordId: crm.person.id });
    expect(context).toMatchObject({ ok: true, sendingAs: { kind: 'personal' }, backgroundSyncAvailable: false });

    const mark = await simulator.mark();
    const { summary } = await sendPdf(token, crm, 'Contrato OAuth E2E');
    const assignments = (await simulator.logSince(mark)).filter(({ method, path }) => method === 'POST' && path.endsWith('/assignments'));
    expect(assignments).toEqual([expect.objectContaining({ status: 200, grantId: personal.grantId })]);

    expect(await callRoute<DocumentSummary>('/s/assinafy/documents/cancel', token, { documentRecordId: summary.documentRecordId })).toMatchObject({
      ok: true,
      status: 'CANCELLED',
    });
  });

  it('a shared connection serves the health check', async () => {
    shared = await connect('workspace');
    expect(shared.account.visibility).toBe('workspace');
    const mark = await simulator.mark();

    expect(await runHealthCheck(app)).toMatchObject({ status: 'OK' });
    expect((await simulator.logSince(mark)).filter(({ path }) => path === '/v1/accounts').at(-1)).toMatchObject({
      status: 200,
      grantId: shared.grantId,
    });
  });

  it('refreshes an expired access token with a rotating refresh token and keeps working', async () => {
    const before = await findAccount(personal.account.id);
    await psql(
      `update core."connectedAccount" set "lastCredentialsRefreshedAt" = now() - interval '2 hours' where id = '${personal.account.id}'`,
    );
    const mark = await simulator.mark();

    expect(await callRoute('/s/assinafy/context', token, { recordId: crm.person.id })).toMatchObject({
      ok: true,
      sendingAs: { kind: 'personal' },
    });
    const refreshed = await simulator.logSince(mark);
    const refreshes = refreshed.filter(({ kind }) => kind === 'token');
    expect(refreshes).toEqual([expect.objectContaining({ status: 200, grantType: 'refresh_token', grantId: personal.grantId })]);
    // The calls after the refresh use the rotated access token (issuance 2), not the one issued at connection.
    const personalCalls = (entries: SimLogEntry[]) =>
      entries.filter(({ path, grantId }) => path === '/v1/accounts' && grantId === personal.grantId);
    expect(personalCalls(refreshed).map(({ status, tokenIndex }) => ({ status, tokenIndex }))).toEqual([{ status: 200, tokenIndex: 2 }]);
    expect((await simulator.grants()).find(({ id }) => id === personal.grantId)).toMatchObject({
      refreshCount: 1,
      reuseDetected: false,
      revoked: false,
    });
    const after = await findAccount(personal.account.id);
    expect(Date.parse(after?.lastCredentialsRefreshedAt ?? '')).toBeGreaterThan(Date.parse(before?.lastCredentialsRefreshedAt ?? ''));

    // The rotated token works and is not refreshed again.
    const again = await simulator.mark();
    expect(await callRoute('/s/assinafy/context', token, { recordId: crm.person.id })).toMatchObject({ ok: true });
    const log = await simulator.logSince(again);
    expect(log.filter(({ kind }) => kind === 'token')).toEqual([]);
    expect(personalCalls(log).map(({ status, tokenIndex }) => ({ status, tokenIndex }))).toEqual([{ status: 200, tokenIndex: 2 }]);
  });

  it('deleting a connection revokes its access token with the client credentials', async () => {
    const revokes = await disconnect(personal.account.id);

    // The simulator answers 401 to a revoke without the client id and secret.
    expect(revokes).toEqual([expect.objectContaining({ status: 200, tokenTypeHint: 'access_token', grantId: personal.grantId })]);
    expect((await simulator.grants()).find(({ id }) => id === personal.grantId)?.revoked).toBe(false);
  });

  it('a connection granted without templates:write gets INSUFFICIENT_SCOPE on a template send', async ({ skip }) => {
    const granted = ASSINAFY_OAUTH_SCOPES.filter((scope) => scope !== 'templates:write');
    partial = await connectWithScopes(granted);
    expect(partial.account.scopes).toEqual(granted.filter((scope) => scope !== 'offline_access'));

    const context = await callRoute<SignatureContext>('/s/assinafy/context', token, { recordId: crm.person.id });
    expect(context).toMatchObject({ ok: true, sendingAs: { kind: 'personal' } });
    const template = findSendableTemplate(context.ok ? context.templates : []);
    if (!template) {
      await disconnect(partial.account.id);
      return skip(SENDABLE_TEMPLATE_MISSING);
    }
    const mark = await simulator.mark();

    expect(
      await callRoute('/s/assinafy/prepare', token, {
        recordId: crm.person.id,
        source: { type: 'TEMPLATE', templateId: template.id, editorFields: template.editorFields.map(({ fieldId }) => ({ fieldId, value: 'E2E' })) },
        name: 'Modelo sem permissão E2E',
        signers: template.signerRoles.map((role) => ({ ...E2E_SIGNER, roleId: role.id })),
      }),
    ).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_SCOPE', details: { scope: expect.stringContaining('templates:write') } } });
    expect((await simulator.logSince(mark)).filter(({ status }) => status === 403)).toEqual([
      expect.objectContaining({ method: 'POST', grantId: partial.grantId }),
    ]);
    // By design (SETUP.md, Credentials) a failure after the workspace lookup and the template listing goes back to the
    // member as an error code and does not flag the connection.
    expect((await findAccount(partial.account.id))?.authFailedAt).toBeNull();
    await disconnect(partial.account.id);
  });

  it('a connection granted without templates:read gets INSUFFICIENT_SCOPE and is flagged for reconnection', async () => {
    const granted = ASSINAFY_OAUTH_SCOPES.filter((scope) => !scope.startsWith('templates:'));
    narrowed = await connectWithScopes(granted);
    const mark = await simulator.mark();

    expect(await callRoute('/s/assinafy/context', token, { recordId: crm.person.id })).toMatchObject({
      ok: false,
      error: { code: 'INSUFFICIENT_SCOPE', details: { scope: 'templates:read' } },
    });
    expect((await simulator.logSince(mark)).filter(({ status }) => status === 403)).toEqual([
      expect.objectContaining({ method: 'GET', path: expect.stringMatching(/\/templates$/), grantId: narrowed.grantId }),
    ]);
    expect(await findAccount(narrowed.account.id)).toMatchObject({
      authFailedAt: expect.any(String),
      authFailedReason: 'Reconecte a Assinafy e conceda a permissão templates:read.',
    });
  });

  it('a personal grant revoked in Assinafy answers RECONNECT_REQUIRED and flags the connection', async () => {
    revoked = await connect('user');
    await simulator.revokeGrant(revoked.grantId);
    const mark = await simulator.mark();

    expect(await callRoute('/s/assinafy/context', token, { recordId: crm.person.id })).toMatchObject({
      ok: false,
      error: { code: 'RECONNECT_REQUIRED' },
    });
    // The refused personal connection is not replaced by the (still valid) shared one: the only call is the refused one.
    expect((await simulator.logSince(mark)).map(({ method, path, status }) => `${method} ${path} ${status}`)).toEqual([
      'GET /v1/accounts 401',
    ]);
    expect(await findAccount(revoked.account.id)).toMatchObject({
      authFailedAt: expect.any(String),
      authFailedReason: 'A Assinafy recusou a conexão. Reconecte para continuar.',
    });
  });

  it('a personal connection whose refresh Assinafy refuses is dropped, and calls go out visibly as the shared one', async () => {
    refreshRefused = await connect('user');
    await simulator.revokeGrant(refreshRefused.grantId);
    await psql(
      `update core."connectedAccount" set "lastCredentialsRefreshedAt" = now() - interval '2 hours' where id = '${refreshRefused.account.id}'`,
    );
    const mark = await simulator.mark();

    // Twenty's listing silently leaves out a connection whose refresh failed (SETUP.md, Credential resolution), so the
    // next candidate serves the call and the review step shows who is sending.
    expect(await callRoute('/s/assinafy/context', token, { recordId: crm.person.id })).toMatchObject({
      ok: true,
      sendingAs: { kind: 'shared' },
    });
    const log = await simulator.logSince(mark);
    expect(log.filter(({ kind }) => kind === 'token')).toEqual([
      expect.objectContaining({ status: 400, grantType: 'refresh_token', grantId: refreshRefused.grantId }),
    ]);
    const api = log.filter(({ kind }) => kind === 'api');
    expect(api.length).toBeGreaterThan(0);
    expect(api.every(({ grantId }) => grantId === shared.grantId)).toBe(true);
    // Twenty does not flag the connection, and the app flags only shared connections that stay missing.
    expect(await findAccount(refreshRefused.account.id)).toMatchObject({ authFailedAt: null });

    // Its grant has already ended in Assinafy and its token can no longer be read, so the disconnect sends no revoke.
    expect(await disconnect(refreshRefused.account.id)).toEqual([]);
  });

  it('a shared grant revoked in Assinafy fails the health check and flags the connection', async () => {
    await simulator.revokeGrant(shared.grantId);

    expect(await runHealthCheck(app)).toEqual({
      status: 'ERROR',
      title: 'Uma conexão compartilhada com a Assinafy foi recusada',
      description: 'A autorização expirou ou foi revogada na Assinafy. Reconecte-a na aba Geral.',
      action: { label: 'Reconectar' },
    });
    expect((await findAccount(shared.account.id))?.authFailedAt).toEqual(expect.any(String));
  });

  it('deleting flagged connections still revokes their access tokens', async () => {
    const narrowedRevokes = await disconnect(narrowed.account.id);
    expect(narrowedRevokes).toEqual([expect.objectContaining({ status: 200, tokenTypeHint: 'access_token', grantId: narrowed.grantId })]);
    expect((await simulator.grants()).find(({ id }) => id === narrowed.grantId)?.revoked).toBe(false);

    // Grants already ended in Assinafy: the revoke is still sent and accepted.
    for (const { account } of [revoked, shared]) {
      expect(await disconnect(account.id)).toEqual([expect.objectContaining({ status: 200, tokenTypeHint: 'access_token' })]);
    }
    expect(await listConnectedAccounts(app)).toEqual([]);
  });
});
