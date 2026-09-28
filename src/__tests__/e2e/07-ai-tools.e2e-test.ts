import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { sendPdf } from 'src/__tests__/e2e/e2e-flows';
import { clearApiKey, type E2eApp, findE2eApp, frontEndToken, useSimulatorApiKey } from 'src/__tests__/e2e/e2e-twenty';
import { simulator } from 'src/__tests__/e2e/simulator-client';
import { createCrmFixtures, type CrmFixtures } from 'src/__tests__/integration/crm-fixtures';
import { callRoute, executeLogicFunction, runCleanup } from 'src/__tests__/integration/twenty-api';
import {
  GET_DOCUMENT_STATUS_TOOL_UNIVERSAL_IDENTIFIER,
  GET_SIGNATURE_CONTEXT_TOOL_UNIVERSAL_IDENTIFIER,
  PROPOSE_SIGNATURE_REQUEST_TOOL_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

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
  await runCleanup(cleanup);
  await clearApiKey(app);
});

// The AI chat calls these tools as logic functions for the signed-in member; no model is needed to run them.
describe('AI tools', () => {
  it('get-signature-context-tool describes what the record can send, from Assinafy', async () => {
    const mark = await simulator.mark();

    expect(await executeLogicFunction(app, GET_SIGNATURE_CONTEXT_TOOL_UNIVERSAL_IDENTIFIER, { recordId: crm.person.id })).toMatchObject({
      status: 'SUCCESS',
      data: {
        ok: true,
        record: { objectNameSingular: 'person', id: crm.person.id },
        sendingAs: { kind: 'apiKey' },
        attachments: [{ id: crm.pdfAttachment.id }],
        suggestedSigners: [{ personId: crm.person.id, email: crm.person.email }],
      },
    });
    expect((await simulator.logSince(mark)).map(({ method, path }) => `${method} ${path}`)).toEqual(
      expect.arrayContaining(['GET /v1/accounts', expect.stringMatching(/^GET \/v1\/accounts\/[^/]+\/templates$/)]),
    );
  });

  it('propose-signature-request drafts the request from CRM people without calling anything billable', async () => {
    const mark = await simulator.mark();

    expect(
      await executeLogicFunction(app, PROPOSE_SIGNATURE_REQUEST_TOOL_UNIVERSAL_IDENTIFIER, {
        recordId: crm.person.id,
        sourceType: 'PDF',
        attachmentId: crm.pdfAttachment.id,
        signerPersonIds: [crm.person.id],
        name: 'Proposta E2E',
      }),
    ).toMatchObject({
      status: 'SUCCESS',
      data: {
        ok: true,
        proposal: {
          recordId: crm.person.id,
          source: { type: 'PDF', attachmentId: crm.pdfAttachment.id },
          name: 'Proposta E2E',
          signers: [{ name: 'Ana Integração', email: crm.person.email, verificationMethod: 'Email', notificationMethod: 'Email' }],
        },
      },
    });
    expect((await simulator.logSince(mark)).filter(({ method }) => method !== 'GET')).toEqual([]);
  });

  it('propose-signature-request refuses an attachment the record does not have', async () => {
    expect(
      await executeLogicFunction(app, PROPOSE_SIGNATURE_REQUEST_TOOL_UNIVERSAL_IDENTIFIER, {
        recordId: crm.person.id,
        attachmentId: crm.textAttachment.id,
      }),
    ).toMatchObject({ status: 'SUCCESS', data: { ok: false, error: { code: 'INVALID_INPUT', details: { field: 'attachmentId' } } } });
  });

  it('get-assinafy-document-status refreshes a request and summarizes it in pt-BR', async () => {
    const { summary, prepared } = await sendPdf(token, crm, 'Status E2E');
    const mark = await simulator.mark();

    const result = await executeLogicFunction(app, GET_DOCUMENT_STATUS_TOOL_UNIVERSAL_IDENTIFIER, { documentRecordId: summary.documentRecordId });

    expect(result).toMatchObject({
      status: 'SUCCESS',
      data: {
        ok: true,
        document: { documentRecordId: summary.documentRecordId, status: 'PENDING_SIGNATURE', signerCount: 1 },
        text: expect.stringContaining('O documento "Status E2E" está aguardando assinaturas. Assinaturas: 0 de 1.'),
      },
    });
    expect((await simulator.logSince(mark)).filter(({ method }) => method === 'GET').map(({ path }) => path)).toContain(
      `/v1/documents/${prepared.assinafyDocumentId}`,
    );

    expect(await callRoute('/s/assinafy/documents/cancel', token, { documentRecordId: summary.documentRecordId })).toMatchObject({
      ok: true,
      status: 'CANCELLED',
    });
  });
});
