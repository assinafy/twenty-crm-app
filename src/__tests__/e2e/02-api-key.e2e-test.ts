import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  E2E_SIGNER,
  findDocumentRecord,
  findSendableTemplate,
  patchPendingUpload,
  pdfRequest,
  prepare,
  readPendingUploads,
  sendBody,
  SENDABLE_TEMPLATE_MISSING,
  sendPdf,
  shortDeadline,
  waitUntilProcessed,
} from 'src/__tests__/e2e/e2e-flows';
import {
  clearApiKey,
  type E2eApp,
  findE2eApp,
  frontEndToken,
  runHealthCheck,
  useSimulatorApiKey,
} from 'src/__tests__/e2e/e2e-twenty';
import { graphql } from 'src/__tests__/e2e/graphql';
import { poll } from 'src/__tests__/e2e/poll';
import { type SimLogEntry, simulator } from 'src/__tests__/e2e/simulator-client';
import { createCrmFixtures, type CrmFixtures } from 'src/__tests__/integration/crm-fixtures';
import { callRoute, runCleanup } from 'src/__tests__/integration/twenty-api';
import { type CostEstimate } from 'src/types/cost-estimate';
import { type DocumentSummary } from 'src/types/document-summary';
import { type SignatureContext } from 'src/types/signature-context';

const ACCOUNT_ID = process.env.ASSINAFY_SANDBOX_ACCOUNT_ID ?? '';

const cleanup: Array<() => Promise<unknown>> = [];
let app: E2eApp;
let crm: CrmFixtures;
let token: string;

const calls = (entries: SimLogEntry[], method: string, path: RegExp) =>
  entries.filter((entry) => entry.method === method && path.test(entry.path));

beforeAll(async () => {
  app = await findE2eApp();
  crm = await createCrmFixtures(cleanup);
  token = await frontEndToken(app);
  await useSimulatorApiKey(app);
});

afterAll(async () => {
  await runCleanup(cleanup);
  await clearApiKey(app);
});

describe('API key credential through the simulator', () => {
  it('the health check passes', async () => {
    const mark = await simulator.mark();

    expect(await runHealthCheck(app)).toMatchObject({ status: 'OK' });
    expect(calls(await simulator.logSince(mark), 'GET', /^\/v1\/accounts$/).at(-1)).toMatchObject({ status: 200, kind: 'api' });
  });

  it('/context sends as the API key and lists the record PDF and the sandbox templates', async () => {
    const mark = await simulator.mark();
    const context = await callRoute<SignatureContext>('/s/assinafy/context', token, { recordId: crm.person.id });

    expect(context).toMatchObject({
      ok: true,
      record: { objectNameSingular: 'person', id: crm.person.id },
      sendingAs: { kind: 'apiKey', accountName: expect.any(String) },
      backgroundSyncAvailable: true,
      attachments: [{ id: crm.pdfAttachment.id, name: crm.pdfAttachment.name }],
    });
    expect(context.ok && context.sendingAs?.accountId === ACCOUNT_ID).toBe(true);
    const log = await simulator.logSince(mark);
    expect(calls(log, 'GET', /^\/v1\/accounts\/[^/]+\/templates$/)).toEqual([expect.objectContaining({ status: 200 })]);
  });

  describe('a PDF sent, retried, refreshed, resent and cancelled', () => {
    let sent: Awaited<ReturnType<typeof sendPdf>>;
    let mark: number;

    it('/prepare uploads the PDF and estimates it; the send then forgets the upload', async () => {
      mark = await simulator.mark();
      sent = await sendPdf(token, crm, 'Contrato E2E');
      const log = await simulator.logSince(mark);
      const documentId = sent.prepared.assinafyDocumentId ?? '';

      expect(sent.prepared).toMatchObject({ accountName: expect.any(String), estimate: { sufficient: true } });
      expect(calls(log, 'POST', /^\/v1\/accounts\/[^/]+\/documents$/)).toEqual([expect.objectContaining({ status: 200 })]);
      expect(calls(log, 'POST', new RegExp(`^/v1/documents/${documentId}/assignments/estimate-cost$`)).length).toBeGreaterThanOrEqual(2);
      // The send forgets the upload: it is no longer a draft the purge may delete.
      expect((await readPendingUploads(app.id)).map((entry) => entry.documentId)).not.toContain(documentId);
    });

    it('/send creates the PENDING_SIGNATURE record with its signers and timeline entry, after one assignment call', async () => {
      const log = await simulator.logSince(mark);
      const documentId = sent.prepared.assinafyDocumentId ?? '';
      const record = await findDocumentRecord(sent.summary.documentRecordId);

      expect(calls(log, 'POST', new RegExp(`^/v1/documents/${documentId}/assignments$`))).toEqual([
        expect.objectContaining({ status: 200 }),
      ]);
      expect(record).toMatchObject({
        status: 'PENDING_SIGNATURE',
        requestId: sent.body.requestId,
        assinafyDocumentId: documentId,
        assinafyAssignmentId: expect.any(String),
        signerCount: 1,
        signedCount: 0,
        personId: crm.person.id,
      });
      // Twenty reads an empty text field back as an empty string.
      expect(record?.lastError || null).toBeNull();
      expect(record?.signers).toHaveLength(1);

      const { timelineActivities } = await graphql<{
        timelineActivities: { edges: Array<{ node: { linkedRecordId: string; name: string } }> };
      }>(
        'graphql',
        'query ($id: UUID!) { timelineActivities(filter: { targetPersonId: { eq: $id } }) { edges { node { linkedRecordId name } } } }',
        { id: crm.person.id },
      );
      expect(timelineActivities.edges.map(({ node }) => node.linkedRecordId)).toContain(sent.summary.documentRecordId);
    });

    it('a retry with the same requestId returns the same record without a second assignment', async () => {
      const retryMark = await simulator.mark();
      const retry = await callRoute<DocumentSummary>('/s/assinafy/send', token, sent.body);

      expect(retry).toMatchObject({ ok: true, documentRecordId: sent.summary.documentRecordId });
      expect(calls(await simulator.logSince(retryMark), 'POST', /\/assignments$/)).toEqual([]);
      expect(calls(await simulator.logSince(mark), 'POST', /\/assignments$/)).toHaveLength(1);
    });

    it('/documents/refresh reads the document from Assinafy', async () => {
      const refreshMark = await simulator.mark();
      const documentId = sent.prepared.assinafyDocumentId ?? '';
      const refreshed = await callRoute<DocumentSummary>('/s/assinafy/documents/refresh', token, {
        documentRecordId: sent.summary.documentRecordId,
      });

      expect(refreshed).toMatchObject({ ok: true, status: 'PENDING_SIGNATURE', lastSyncedAt: expect.any(String) });
      expect(calls(await simulator.logSince(refreshMark), 'GET', new RegExp(`^/v1/documents/${documentId}$`))).toEqual([
        expect.objectContaining({ status: 200 }),
      ]);
    });

    it('quotes a resend, then resends once at the confirmed cost', async () => {
      // Assinafy notifies the signer asynchronously; the resend needs a notified signer.
      const notified = await poll(
        () =>
          callRoute<DocumentSummary>('/s/assinafy/documents/refresh', token, {
            documentRecordId: sent.summary.documentRecordId,
          }),
        (summary) => summary.ok && summary.signers[0]?.notified === true,
        { timeoutMs: 120_000, intervalMs: 5_000, label: 'Assinafy to notify the signer' },
      );
      const signerId = notified.ok ? (notified.signers[0]?.id ?? '') : '';
      const resendMark = await simulator.mark();

      const quote = await callRoute<{ estimate: CostEstimate }>('/s/assinafy/documents/resend', token, {
        documentRecordId: sent.summary.documentRecordId,
        signerId,
      });
      expect(quote).toMatchObject({ ok: true, estimate: { totalCredits: expect.any(Number) } });
      const totalCredits = quote.ok ? quote.estimate.totalCredits : -1;

      const resent = await callRoute<DocumentSummary>('/s/assinafy/documents/resend', token, {
        documentRecordId: sent.summary.documentRecordId,
        signerId,
        expectedTotalCredits: totalCredits,
      });
      expect(resent).toMatchObject({ ok: true, documentRecordId: sent.summary.documentRecordId, status: 'PENDING_SIGNATURE' });
      const log = await simulator.logSince(resendMark);
      expect(calls(log, 'POST', /\/estimate-resend-cost$/)).toHaveLength(2);
      expect(calls(log, 'PUT', /\/resend$/)).toEqual([expect.objectContaining({ status: 200 })]);
    });

    it('/documents/cancel cancels the request in Assinafy and on the record', async () => {
      const cancelMark = await simulator.mark();
      const documentId = sent.prepared.assinafyDocumentId ?? '';
      const cancelled = await callRoute<DocumentSummary>('/s/assinafy/documents/cancel', token, {
        documentRecordId: sent.summary.documentRecordId,
      });

      expect(cancelled).toMatchObject({ ok: true, status: 'CANCELLED' });
      expect((await findDocumentRecord(sent.summary.documentRecordId))?.status).toBe('CANCELLED');
      expect(calls(await simulator.logSince(cancelMark), 'DELETE', new RegExp(`^/v1/documents/${documentId}$`))).toEqual([
        expect.objectContaining({ status: 200 }),
      ]);
    });
  });

  it('/discard deletes a fresh upload the member prepared and forgets it', async () => {
    const prepared = await prepare(token, pdfRequest(crm, 'Descartado E2E'));
    const documentId = prepared.assinafyDocumentId ?? '';
    expect(await readPendingUploads(app.id)).toContainEqual(expect.objectContaining({ documentId, userWorkspaceId: expect.any(String) }));
    await waitUntilProcessed(documentId);
    const mark = await simulator.mark();

    expect(await callRoute('/s/assinafy/discard', token, { assinafyDocumentId: documentId, accountId: prepared.accountId })).toEqual({
      ok: true,
    });
    expect(calls(await simulator.logSince(mark), 'DELETE', new RegExp(`^/v1/documents/${documentId}$`))).toEqual([
      expect.objectContaining({ status: 200 }),
    ]);
    expect((await readPendingUploads(app.id)).map((entry) => entry.documentId)).not.toContain(documentId);
  });

  it('/discard refuses an upload another member prepared and deletes nothing', async () => {
    const prepared = await prepare(token, pdfRequest(crm, 'De outro membro E2E'));
    const documentId = prepared.assinafyDocumentId ?? '';
    const own = (await readPendingUploads(app.id)).find((entry) => entry.documentId === documentId);
    await patchPendingUpload(app.id, documentId, { userWorkspaceId: crypto.randomUUID() });
    const mark = await simulator.mark();

    expect(await callRoute('/s/assinafy/discard', token, { assinafyDocumentId: documentId, accountId: prepared.accountId })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_STATE' },
    });
    expect(calls(await simulator.logSince(mark), 'DELETE', /^\/v1\/documents\//)).toEqual([]);
    expect((await readPendingUploads(app.id)).map((entry) => entry.documentId)).toContain(documentId);

    // Handed back to the member, it can be discarded.
    await waitUntilProcessed(documentId);
    await patchPendingUpload(app.id, documentId, { userWorkspaceId: own?.userWorkspaceId ?? null });
    expect(await callRoute('/s/assinafy/discard', token, { assinafyDocumentId: documentId, accountId: prepared.accountId })).toEqual({
      ok: true,
    });
  });

  it('sends a template, then cancels it', async ({ skip }) => {
    const context = await callRoute<SignatureContext>('/s/assinafy/context', token, { recordId: crm.person.id });
    expect(context).toMatchObject({ ok: true });
    const template = findSendableTemplate(context.ok ? context.templates : []);
    if (!template) {
      return skip(SENDABLE_TEMPLATE_MISSING);
    }
    const request = {
      recordId: crm.person.id,
      source: {
        type: 'TEMPLATE',
        templateId: template.id,
        editorFields: template.editorFields.map(({ fieldId }) => ({ fieldId, value: 'E2E' })),
      },
      name: 'Modelo E2E',
      signers: template.signerRoles.map((role) => ({ ...E2E_SIGNER, roleId: role.id })),
      expiresAt: shortDeadline(),
    };
    const mark = await simulator.mark();
    const prepared = await prepare(token, request);
    expect(prepared.assinafyDocumentId).toBeNull();

    const summary = await callRoute<DocumentSummary>('/s/assinafy/send', token, sendBody(request, prepared));
    expect(summary).toMatchObject({ ok: true, status: 'PENDING_SIGNATURE' });
    const log = await simulator.logSince(mark);
    expect(calls(log, 'POST', /^\/v1\/accounts\/[^/]+\/templates\/[^/]+\/documents$/)).toEqual([expect.objectContaining({ status: 200 })]);

    const documentRecordId = summary.ok ? summary.documentRecordId : '';
    const documentId = (await findDocumentRecord(documentRecordId))?.assinafyDocumentId;
    expect(documentId).toEqual(expect.any(String));
    const cancelMark = await simulator.mark();
    const cancelled = await callRoute<DocumentSummary>('/s/assinafy/documents/cancel', token, { documentRecordId });
    const deletes = calls(await simulator.logSince(cancelMark), 'DELETE', new RegExp(`^/v1/documents/${documentId}$`));
    expect(deletes).toHaveLength(1);
    const deleteStatus = deletes[0]?.status ?? 0;
    const deleted = deleteStatus >= 200 && deleteStatus < 300;
    // Assinafy may refuse to delete a document created from a template; the app then keeps it waiting for signatures.
    expect({
      handler: cancelled.ok ? cancelled.status : cancelled.error.code,
      record: (await findDocumentRecord(documentRecordId))?.status,
      deleted,
      refused: deleteStatus >= 400 && deleteStatus < 500,
    }).toEqual(
      deleted
        ? { handler: 'CANCELLED', record: 'CANCELLED', deleted, refused: false }
        : { handler: 'PROVIDER_REJECTED', record: 'PENDING_SIGNATURE', deleted, refused: true },
    );
  });
});
