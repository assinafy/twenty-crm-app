import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findDocumentRecord, sendPdf } from 'src/__tests__/e2e/e2e-flows';
import {
  type E2eApp,
  findE2eApp,
  frontEndToken,
  runSyncCron,
  useSimulatorApiKey,
  waitForHealthStatus,
} from 'src/__tests__/e2e/e2e-twenty';
import { poll } from 'src/__tests__/e2e/poll';
import { simulator, type SimWebhookEndpoint } from 'src/__tests__/e2e/simulator-client';
import { createCrmFixtures, type CrmFixtures } from 'src/__tests__/integration/crm-fixtures';
import { callRoute, runCleanup, setAppVariable } from 'src/__tests__/integration/twenty-api';
import { ASSINAFY_WEBHOOK_EMAIL_VARIABLE } from 'src/constants/assinafy';

const WEBHOOK_EMAIL = 'webhooks-e2e@example.invalid';
const cleanup: Array<() => Promise<unknown>> = [];
let app: E2eApp;
let crm: CrmFixtures;
let token: string;

// Twenty memoizes application variables for up to 10 s, so the cron runs until it sees the change.
const cronUntil = (accept: (endpoints: SimWebhookEndpoint[]) => boolean, label: string) =>
  poll(
    async () => {
      await runSyncCron(app);
      return simulator.webhookEndpoints();
    },
    accept,
    { timeoutMs: 60_000, intervalMs: 2_000, label },
  );

beforeAll(async () => {
  app = await findE2eApp();
  crm = await createCrmFixtures(cleanup);
  token = await frontEndToken(app);
  await useSimulatorApiKey(app);
});

afterAll(async () => {
  await runCleanup(cleanup);
});

describe('webhooks', () => {
  let endpoint: SimWebhookEndpoint;

  it('registers one signed endpoint at the public route once the contact email is set', async () => {
    expect(await simulator.webhookEndpoints()).toEqual([]);

    await setAppVariable(app, ASSINAFY_WEBHOOK_EMAIL_VARIABLE, WEBHOOK_EMAIL);
    expect(await waitForHealthStatus(app, 'WARNING', 'the webhook email to reach the functions')).toMatchObject({
      title: 'Os webhooks da Assinafy ainda não estão registrados',
    });

    endpoint = (await cronUntil((endpoints) => endpoints.length === 1, 'the endpoint to be registered'))[0]!;
    expect(endpoint).toMatchObject({
      name: 'Twenty',
      email: WEBHOOK_EMAIL,
      is_active: true,
      signing_enabled: true,
      signed: true,
      events: ['signer_signed_document', 'signer_rejected_document', 'user_rejected_document', 'document_ready', 'document_processing_failed'],
    });
    expect(endpoint.url).toMatch(/\/s\/assinafy\/webhook\?token=[\w-]{43}$/);
    expect(await waitForHealthStatus(app, 'OK', 'the registered endpoint to clear the warning')).toMatchObject({ status: 'OK' });
  });

  it('keeps the same endpoint on later runs', async () => {
    await runSyncCron(app);

    expect(await simulator.webhookEndpoints()).toEqual([endpoint]);
  });

  it('re-reads the document of a signed delivery from Assinafy and refuses a tampered one', async () => {
    const { summary } = await sendPdf(token, crm, 'Webhook E2E');
    const before = await findDocumentRecord(summary.documentRecordId);
    const documentId = before?.assinafyDocumentId ?? '';

    expect(await simulator.deliverWebhook('signer_signed_document', documentId, true)).toEqual([
      { endpointId: endpoint.id, status: 401, body: JSON.stringify({ outcome: 'unauthorized' }) },
    ]);
    expect((await findDocumentRecord(summary.documentRecordId))?.lastSyncedAt).toBe(before?.lastSyncedAt);

    const mark = await simulator.mark();
    expect(await simulator.deliverWebhook('signer_signed_document', documentId)).toEqual([
      { endpointId: endpoint.id, status: 200, body: JSON.stringify({ outcome: 'synced' }) },
    ]);
    const after = await findDocumentRecord(summary.documentRecordId);
    expect(Date.parse(after?.lastSyncedAt ?? '')).toBeGreaterThan(Date.parse(before?.lastSyncedAt ?? '') || 0);
    expect(after?.status).toBe('PENDING_SIGNATURE');
    expect(after?.lastError || null).toBeNull();
    expect((await simulator.logSince(mark)).some(({ method, path }) => method === 'GET' && path === `/v1/documents/${documentId}`)).toBe(true);

    expect(await callRoute('/s/assinafy/documents/cancel', token, { documentRecordId: summary.documentRecordId })).toMatchObject({
      ok: true,
      status: 'CANCELLED',
    });
    expect(await simulator.deliverWebhook('user_rejected_document', documentId)).toEqual([
      { endpointId: endpoint.id, status: 200, body: JSON.stringify({ outcome: 'ignored' }) },
    ]);
  });

  it('removes its endpoint once the email is cleared, and registers a fresh one when it is set again', async () => {
    await setAppVariable(app, ASSINAFY_WEBHOOK_EMAIL_VARIABLE, '');
    await cronUntil((endpoints) => endpoints.length === 0, 'the endpoint to be removed');

    // Left on for the uninstall scenario, which checks that the hook removes it.
    await setAppVariable(app, ASSINAFY_WEBHOOK_EMAIL_VARIABLE, WEBHOOK_EMAIL);
    const [fresh] = await cronUntil((endpoints) => endpoints.length === 1, 'a new endpoint to be registered');
    expect(fresh?.id).not.toBe(endpoint.id);
    expect(fresh?.url).not.toBe(endpoint.url);
  });
});
