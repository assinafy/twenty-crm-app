import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  findDocumentRecord,
  findDocumentRecords,
  patchPendingUpload,
  pdfRequest,
  prepare,
  readPendingUploads,
  sendBody,
  sendPdf,
  waitUntilProcessed,
} from 'src/__tests__/e2e/e2e-flows';
import {
  clearApiKey,
  type E2eApp,
  findE2eApp,
  frontEndToken,
  runSyncCron,
  useSimulatorApiKey,
} from 'src/__tests__/e2e/e2e-twenty';
import { simulator } from 'src/__tests__/e2e/simulator-client';
import { createCrmFixtures, type CrmFixtures } from 'src/__tests__/integration/crm-fixtures';
import { callRoute, runCleanup } from 'src/__tests__/integration/twenty-api';
import { PENDING_UPLOAD_TTL_MS } from 'src/constants/limits';

const cleanup: Array<() => Promise<unknown>> = [];
let app: E2eApp;
let crm: CrmFixtures;
let token: string;

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

describe('sync cron and pending-upload purge', () => {
  it('syncs open requests and purges only the abandoned uploads no send still references', async () => {
    const { summary } = await sendPdf(token, crm, 'Sincronizado E2E');
    const sentBefore = await findDocumentRecord(summary.documentRecordId);

    // An upload abandoned more than a day ago.
    const abandoned = (await prepare(token, pdfRequest(crm, 'Abandonado E2E'))).assinafyDocumentId ?? '';
    await waitUntilProcessed(abandoned);

    // An upload a send claimed but never assigned (the assignment call failed before reaching Assinafy): the record
    // stays UNCERTAIN and still references the upload.
    const claimedRequest = pdfRequest(crm, 'Reivindicado E2E');
    const claimedPrepared = await prepare(token, claimedRequest);
    const claimed = claimedPrepared.assinafyDocumentId ?? '';
    await simulator.addFaults([
      { method: 'POST', pathRegex: `^/v1/documents/${claimed}/assignments$`, times: 1, phase: 'before', action: { status: 503 } },
    ]);
    const claimedBody = sendBody(claimedRequest, claimedPrepared);
    expect(await callRoute('/s/assinafy/send', token, claimedBody)).toMatchObject({ ok: false, error: { code: 'UNCERTAIN' } });
    const [claimedRecord] = await findDocumentRecords({ requestId: { eq: claimedBody.requestId } });
    expect(claimedRecord).toMatchObject({ status: 'UNCERTAIN', assinafyDocumentId: claimed });
    await waitUntilProcessed(claimed);

    const dayAgo = new Date(Date.now() - PENDING_UPLOAD_TTL_MS - 60_000).toISOString();
    await patchPendingUpload(app.id, abandoned, { createdAt: dayAgo });
    await patchPendingUpload(app.id, claimed, { createdAt: dayAgo });
    const mark = await simulator.mark();

    const counts = await runSyncCron(app);

    expect(counts).toMatchObject({ purged: 1, failed: 0 });
    expect(counts.synced).toBeGreaterThanOrEqual(2);
    const log = await simulator.logSince(mark);
    expect(log.filter(({ method }) => method === 'DELETE').map(({ path, status }) => `${path} ${status}`)).toEqual([
      `/v1/documents/${abandoned} 200`,
    ]);
    const pending = (await readPendingUploads(app.id)).map(({ documentId }) => documentId);
    expect(pending).not.toContain(abandoned);
    expect(pending).toContain(claimed);

    // The open request was read from Assinafy and its record refreshed.
    expect(log).toContainEqual(expect.objectContaining({ method: 'GET', path: `/v1/documents/${sentBefore?.assinafyDocumentId}`, status: 200 }));
    const sentAfter = await findDocumentRecord(summary.documentRecordId);
    expect(sentAfter?.status).toBe('PENDING_SIGNATURE');
    expect(Date.parse(sentAfter?.lastSyncedAt ?? '')).toBeGreaterThan(Date.parse(sentBefore?.lastSyncedAt ?? '') || 0);
    // A send that may still land in Assinafy stays UNCERTAIN until its lease ends.
    expect((await findDocumentRecord(claimedRecord?.id ?? ''))?.status).toBe('UNCERTAIN');

    expect(await callRoute('/s/assinafy/documents/cancel', token, { documentRecordId: summary.documentRecordId })).toMatchObject({
      ok: true,
      status: 'CANCELLED',
    });
  });
});
