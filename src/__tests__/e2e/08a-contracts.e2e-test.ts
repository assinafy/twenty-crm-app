import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';

import { SIM_URL } from 'src/__tests__/e2e/e2e-constants';
import { sendPdf } from 'src/__tests__/e2e/e2e-flows';
import { type E2eApp, findE2eApp, frontEndToken, runSyncCron, useSimulatorApiKey } from 'src/__tests__/e2e/e2e-twenty';
import { findAssinafyDocumentTable } from 'src/__tests__/e2e/find-assinafy-document-table';
import { graphql } from 'src/__tests__/e2e/graphql';
import { poll } from 'src/__tests__/e2e/poll';
import { psql } from 'src/__tests__/e2e/psql';
import { fetchInContainer, simulator } from 'src/__tests__/e2e/simulator-client';
import { buildContract } from 'src/__tests__/fixtures/build-contract';
import { createCrmFixtures } from 'src/__tests__/integration/crm-fixtures';
import { callRoute, runCleanup, setAppVariable } from 'src/__tests__/integration/twenty-api';
import { ASSINAFY_WEBHOOK_EMAIL_VARIABLE } from 'src/constants/assinafy';
import { type ContractSummary } from 'src/types/contract-summary';
import { type ContractTerms } from 'src/types/contract-terms';

type RootContract = Extract<ContractSummary, { kind: 'contract' }>;
type ContractRow = {
  status: string;
  completedAt: string | null;
  contractStatus: string | null;
  contractDetails: ContractSummary | null;
  contractSyncedAt: string | null;
};

const TERMS: ContractTerms = {
  status: 'active', counterparty_name: 'Empresa E2E', value: 1200.5, currency: 'BRL',
  start_date: '2030-01-01', end_date: '2030-10-31', auto_renew: false, renewal_term_months: 12, notice_period_days: 30,
};
const cleanup: Array<() => Promise<unknown>> = [];
let app: E2eApp;
let token: string;
let documentRecordId: string;
let documentId = '';
let contractPath: string;
let current: RootContract;

const call = (input: object) => callRoute<{ contract: ContractSummary | null }>(
  '/s/assinafy/documents/contract', token, { documentRecordId, ...input },
);

const rootContract = async (input: object): Promise<RootContract> => {
  const result = await call(input);
  expect(result).toMatchObject({ ok: true, contract: { kind: 'contract' } });
  if (!result.ok || result.contract?.kind !== 'contract') throw new Error('The route did not return contract terms');
  return result.contract;
};

const row = async (): Promise<ContractRow> => {
  const { assinafyDocuments } = await graphql<{ assinafyDocuments: { edges: Array<{ node: ContractRow }> } }>(
    'graphql',
    `query ($id: UUID!) { assinafyDocuments(filter: { id: { eq: $id } }) { edges { node {
      status completedAt contractStatus contractDetails contractSyncedAt
    } } } }`,
    { id: documentRecordId },
  );
  expect(assinafyDocuments.edges).toHaveLength(1);
  return assinafyDocuments.edges[0]!.node;
};

const writesSince = async (mark: number) => (await simulator.logSince(mark))
  .filter(({ method, path }) => method !== 'GET' && path.startsWith(contractPath));

// A final signature is a local fixture here; the sandbox signer never needs to complete a real signature.
const certifyRecordFixture = async () => {
  const table = await findAssinafyDocumentTable();
  if (!/^[a-f0-9-]{36}$/.test(documentRecordId)) {
    throw new Error('Unexpected test record location');
  }
  await psql(`update ${table} set status = 'CERTIFICATED', "completedAt" = now() where id = '${documentRecordId}'`);
};

beforeAll(async () => {
  app = await findE2eApp();
  await useSimulatorApiKey(app);
  token = await frontEndToken(app);
  const crm = await createCrmFixtures(cleanup);
  const sent = await sendPdf(token, crm, 'Gestão de contrato E2E');
  documentRecordId = sent.summary.documentRecordId;
  documentId = sent.prepared.assinafyDocumentId ?? '';
  if (!documentId) throw new Error('The sandbox send returned no document');
  contractPath = `/v1/accounts/${sent.prepared.accountId}/documents/${documentId}/contract`;
  await simulator.seedContract(documentId, null);
  await setAppVariable(app, ASSINAFY_WEBHOOK_EMAIL_VARIABLE, 'contract-webhooks@example.invalid');
  await poll(async () => {
    await runSyncCron(app);
    return simulator.webhookEndpoints();
  }, (endpoints) => endpoints.some(({ events }) => events.includes('document_contract_updated')), {
    timeoutMs: 60_000, intervalMs: 2_000, label: 'the contract webhook subscription',
  });
});

afterAll(async () => {
  await simulator.clearFaults();
  await simulator.configure({ contractTrackingEnabled: true });
  if (documentId) {
    const response = await fetchInContainer(`${SIM_URL}/v1/documents/${documentId}`, {
      method: 'DELETE', headers: { 'X-Api-Key': inject('simApiKey') },
    });
    if (![200, 404].includes(response.status)) throw new Error(`Sandbox cleanup answered ${response.status}`);
  }
  await runCleanup(cleanup);
});

describe('contract tracking through the installed app and CLM simulator', () => {
  it('reads absence without inventing terms, then creates and stores the reviewed contract', async () => {
    expect(await call({ action: 'get' })).toEqual({ ok: true, contract: null });
    expect(await row()).toMatchObject({ contractStatus: null, contractDetails: null });
    const mark = await simulator.mark();

    current = await rootContract({ action: 'set', updatedAt: null, terms: TERMS });

    expect(current).toMatchObject({ ...TERMS, kind: 'contract', term: 1, updatedAt: expect.any(String) });
    expect(await writesSince(mark)).toEqual([expect.objectContaining({ method: 'PUT', path: contractPath, status: 200 })]);
    expect(await row()).toMatchObject({ status: 'PENDING_SIGNATURE', contractStatus: 'ACTIVE', contractDetails: current });
  });

  it('rejects a stale review before writing and strips private provider fields from refreshed terms', async () => {
    await simulator.seedContract(documentId, buildContract({
      ...TERMS, document_id: documentId, value: 2000, updated_at: new Date(Date.parse(current.updatedAt) + 1000).toISOString(),
    }));
    const mark = await simulator.mark();

    expect(await call({ action: 'set', updatedAt: current.updatedAt, terms: { ...TERMS, value: 3000 } }))
      .toMatchObject({ ok: false, error: { code: 'CONTRACT_CHANGED' } });
    expect(await writesSince(mark)).toEqual([]);
    current = await rootContract({ action: 'get' });
    expect(current.value).toBe(2000);
    const stored = (await row()).contractDetails;
    expect(stored).not.toHaveProperty('counterparty_taxpayer_id');
    expect(stored).not.toHaveProperty('metadata');
    expect(stored).not.toHaveProperty('owner_id');
  });

  it('maps a provider revision conflict without retrying the write', async () => {
    await simulator.addFaults([{ method: 'PUT', pathRegex: '/contract$', times: 1, phase: 'before', action: { status: 409 } }]);
    const mark = await simulator.mark();

    expect(await call({ action: 'set', updatedAt: current.updatedAt, terms: TERMS }))
      .toMatchObject({ ok: false, error: { code: 'CONTRACT_CHANGED' } });
    expect(await writesSince(mark)).toEqual([expect.objectContaining({ method: 'PUT', status: 409 })]);
  });

  it('keeps an applied change uncertain after a lost response and reconciles it without a duplicate write', async () => {
    await simulator.addFaults([{ method: 'PUT', pathRegex: '/contract$', times: 1, phase: 'after', action: { status: 500 } }]);
    const mark = await simulator.mark();

    expect(await call({ action: 'set', updatedAt: current.updatedAt, terms: { ...TERMS, value: 2500 } }))
      .toMatchObject({ ok: false, error: { code: 'CONTRACT_UNCERTAIN' } });
    expect(await writesSince(mark)).toEqual([expect.objectContaining({ method: 'PUT', status: 500 })]);
    expect((await row()).contractDetails).toMatchObject({ value: 2000 });
    current = await rootContract({ action: 'get' });
    expect(current.value).toBe(2500);
  });

  it('renews once from the reviewed term, rejects a repeated review and terminates the contract', async () => {
    const reviewed = current;
    const mark = await simulator.mark();
    current = await rootContract({ action: 'renew', updatedAt: reviewed.updatedAt, term: reviewed.term });
    expect(current).toMatchObject({ status: 'active', term: 2, end_date: '2031-10-31' });
    expect(await call({ action: 'renew', updatedAt: reviewed.updatedAt, term: reviewed.term }))
      .toMatchObject({ ok: false, error: { code: 'CONTRACT_CHANGED' } });
    expect(await writesSince(mark)).toEqual([expect.objectContaining({ method: 'POST', path: `${contractPath}/renew`, status: 200 })]);

    current = await rootContract({ action: 'terminate', updatedAt: current.updatedAt, reason: 'Encerramento E2E' });
    expect(current.status).toBe('terminated');
    expect(await row()).toMatchObject({ status: 'PENDING_SIGNATURE', contractStatus: 'TERMINATED' });
  });

  it('authenticates a lifecycle webhook and re-reads terms while signatures are still pending', async () => {
    await simulator.seedContract(documentId, buildContract({ document_id: documentId, status: 'expired', value: 7777 }));
    const before = await row();
    const refused = await simulator.deliverWebhook('document_contract_expired', documentId, true);
    expect(refused).toEqual([expect.objectContaining({ status: 401, body: JSON.stringify({ outcome: 'unauthorized' }) })]);
    expect(await row()).toEqual(before);
    const mark = await simulator.mark();

    expect(await simulator.deliverWebhook('document_contract_expired', documentId))
      .toEqual([expect.objectContaining({ status: 200, body: JSON.stringify({ outcome: 'synced' }) })]);

    expect(await row()).toMatchObject({ status: 'PENDING_SIGNATURE', contractStatus: 'EXPIRED', contractDetails: { value: 7777 } });
    expect((await simulator.logSince(mark)).filter(({ kind }) => kind === 'api'))
      .toEqual(expect.arrayContaining([expect.objectContaining({ method: 'GET', path: contractPath, status: 200 })]));
  });

  it('polls missed changes after certification and still accepts a signed CLM event for that final signature', async () => {
    await certifyRecordFixture();
    await simulator.seedContract(documentId, buildContract({ ...TERMS, document_id: documentId, value: 8888 }));
    const mark = await simulator.mark();

    expect((await runSyncCron(app)).synced).toBeGreaterThanOrEqual(1);

    const polled = await row();
    expect(polled).toMatchObject({ status: 'CERTIFICATED', contractStatus: 'ACTIVE', contractDetails: { value: 8888 } });
    await simulator.seedContract(documentId, buildContract({ ...TERMS, document_id: documentId, value: 9999 }));
    expect(await simulator.deliverWebhook('document_contract_updated', documentId))
      .toEqual([expect.objectContaining({ status: 200, body: JSON.stringify({ outcome: 'synced' }) })]);
    expect(await row()).toMatchObject({ status: 'CERTIFICATED', completedAt: polled.completedAt, contractDetails: { value: 9999 } });
    expect((await simulator.logSince(mark)).filter(({ path }) => path === `/v1/documents/${documentId}`)).toEqual([]);
  });

  it('keeps reads available while a plan refusal blocks contract writes', async () => {
    await simulator.configure({ contractTrackingEnabled: false });
    try {
      current = await rootContract({ action: 'get' });
      expect(await call({ action: 'set', updatedAt: current.updatedAt, terms: TERMS }))
        .toMatchObject({ ok: false, error: { code: 'CONTRACT_UNAVAILABLE' } });
      expect((await row()).contractDetails).toMatchObject({ value: 9999 });
    } finally {
      await simulator.configure({ contractTrackingEnabled: true });
    }
  });
});
