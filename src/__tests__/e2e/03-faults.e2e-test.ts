import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findDocumentRecords, pdfRequest, prepare, sendBody } from 'src/__tests__/e2e/e2e-flows';
import {
  clearApiKey,
  type E2eApp,
  findE2eApp,
  frontEndToken,
  runHealthCheck,
  runSyncCron,
  useSimulatorApiKey,
  waitForHealthStatus,
} from 'src/__tests__/e2e/e2e-twenty';
import { simulator } from 'src/__tests__/e2e/simulator-client';
import { createCrmFixtures, type CrmFixtures } from 'src/__tests__/integration/crm-fixtures';
import { callRoute, runCleanup, setAppVariable } from 'src/__tests__/integration/twenty-api';
import { ASSINAFY_API_KEY_VARIABLE } from 'src/constants/assinafy';
import { type DocumentSummary } from 'src/types/document-summary';

const cleanup: Array<() => Promise<unknown>> = [];
let app: E2eApp;
let crm: CrmFixtures;
let token: string;
let documentRecordId = '';
let assinafyDocumentId = '';

beforeAll(async () => {
  app = await findE2eApp();
  crm = await createCrmFixtures(cleanup);
  token = await frontEndToken(app);
  await useSimulatorApiKey(app);
});

afterAll(async () => {
  await simulator.clearFaults();
  await runCleanup(cleanup);
  await clearApiKey(app);
});

describe('Assinafy failures', () => {
  it('an assignment accepted upstream but answered 500 leaves an UNCERTAIN record, never a second send', async () => {
    const request = pdfRequest(crm, 'Incerto E2E');
    const prepared = await prepare(token, request);
    assinafyDocumentId = prepared.assinafyDocumentId ?? '';
    const assignmentPath = `^/v1/documents/${assinafyDocumentId}/assignments$`;
    await simulator.addFaults([{ method: 'POST', pathRegex: assignmentPath, times: 1, phase: 'after', action: { status: 500 } }]);
    const mark = await simulator.mark();
    const body = sendBody(request, prepared);

    expect(await callRoute('/s/assinafy/send', token, body)).toMatchObject({ ok: false, error: { code: 'UNCERTAIN' } });

    const [record] = await findDocumentRecords({ requestId: { eq: body.requestId } });
    expect(record).toMatchObject({ status: 'UNCERTAIN', lastError: 'UNCERTAIN', assinafyDocumentId });
    documentRecordId = record?.id ?? '';
    const assignments = (await simulator.logSince(mark)).filter(
      ({ method, path }) => method === 'POST' && new RegExp(assignmentPath).test(path),
    );
    expect(assignments).toEqual([expect.objectContaining({ status: 500, fault: 'after:500' })]);
  });

  it('the sync cron reconciles the UNCERTAIN record from the real sandbox state', async () => {
    const mark = await simulator.mark();
    const counts = await runSyncCron(app);

    expect(counts.synced).toBeGreaterThanOrEqual(1);
    const [record] = await findDocumentRecords({ id: { eq: documentRecordId } });
    expect(record).toMatchObject({ status: 'PENDING_SIGNATURE', assinafyAssignmentId: expect.any(String), sentAt: expect.any(String) });
    expect((await simulator.logSince(mark)).filter(({ method, path }) => method === 'GET' && path === `/v1/documents/${assinafyDocumentId}`)).toEqual([
      expect.objectContaining({ status: 200 }),
    ]);
  });

  it('a refused API key answers RECONNECT_REQUIRED and fails the health check', async () => {
    await setAppVariable(app, ASSINAFY_API_KEY_VARIABLE, 'sim-refused-key');

    try {
      await waitForHealthStatus(app, 'ERROR', 'the refused API key to reach the functions');
      const mark = await simulator.mark();

      expect(await callRoute('/s/assinafy/context', token, { recordId: crm.person.id })).toMatchObject({
        ok: false,
        error: { code: 'RECONNECT_REQUIRED' },
      });
      expect(await runHealthCheck(app)).toEqual({
        status: 'ERROR',
        title: 'A chave de API da Assinafy foi recusada',
        description: 'Crie uma nova chave de API na Assinafy e salve-a na aba Variáveis.',
        action: { label: 'Atualizar chave de API' },
      });
      expect((await simulator.logSince(mark)).filter(({ path }) => path === '/v1/accounts').map(({ status }) => status)).toEqual([401, 401]);
    } finally {
      await useSimulatorApiKey(app);
    }
  });

  it('a read rate-limited by Assinafy answers RATE_LIMITED after the SDK retries', async () => {
    await simulator.addFaults([
      { method: 'GET', pathRegex: `^/v1/documents/${assinafyDocumentId}$`, phase: 'before', action: { status: 429, retryAfter: 1 } },
    ]);
    const mark = await simulator.mark();

    expect(await callRoute('/s/assinafy/documents/refresh', token, { documentRecordId })).toMatchObject({
      ok: false,
      error: { code: 'RATE_LIMITED' },
    });
    const reads = (await simulator.logSince(mark)).filter(({ path }) => path === `/v1/documents/${assinafyDocumentId}`);
    // One call and the SDK's two retries of a GET.
    expect(reads.map(({ status, fault }) => `${status} ${fault}`)).toEqual(Array.from({ length: 3 }, () => '429 before:429'));
    await simulator.clearFaults();
  });

  it('cancels the reconciled request', async () => {
    expect(await callRoute<DocumentSummary>('/s/assinafy/documents/cancel', token, { documentRecordId })).toMatchObject({
      ok: true,
      status: 'CANCELLED',
    });
  });
});
