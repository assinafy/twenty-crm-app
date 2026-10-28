import { randomUUID } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { ApiError } from '@assinafy/sdk';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type E2eApp, findE2eApp, frontEndToken, runSyncCron, waitForHealthStatus } from 'src/__tests__/e2e/e2e-twenty';
import { findAssinafyDocumentTable } from 'src/__tests__/e2e/find-assinafy-document-table';
import { poll } from 'src/__tests__/e2e/poll';
import { psql } from 'src/__tests__/e2e/psql';
import { buildPdf } from 'src/__tests__/fixtures/build-pdf';
import { callRoute, coreClient, setAppVariable, USER_TOKEN } from 'src/__tests__/integration/twenty-api';
import { createAssinafyClientFactory } from 'src/assinafy-client/create-assinafy-client-factory';
import { ASSINAFY_ACCOUNT_ID_VARIABLE, ASSINAFY_API_BASE_URL, ASSINAFY_API_KEY_VARIABLE, ASSINAFY_WEBHOOK_EMAIL_VARIABLE } from 'src/constants/assinafy';
import { findAssinafyDocuments } from 'src/data/find-assinafy-documents';
import { type ContractSummary } from 'src/types/contract-summary';
import { type ContractTerms } from 'src/types/contract-terms';
import { errorName } from 'src/utils/error-name.util';
import { isAssinafyId } from 'src/utils/is-assinafy-id.util';
import { isUnsentDocument } from 'src/utils/is-unsent-document.util';
import { toAppError } from 'src/utils/to-app-error.util';

const PRODUCTION_BASE_URL = 'https://api.assinafy.com.br/v1';
const accountId = process.env.ASSINAFY_PRODUCTION_ACCOUNT_ID ?? '';
const apiKey = process.env.ASSINAFY_PRODUCTION_API_KEY ?? '';
if (process.env.ASSINAFY_PRODUCTION_TESTS !== '1' || !apiKey || !isAssinafyId(accountId) ||
  process.env.TWENTY_API_URL !== 'http://localhost:2021' || ASSINAFY_API_BASE_URL !== PRODUCTION_BASE_URL) {
  throw new Error('Production contract tests require explicit credentials, the production Assinafy host and local Twenty on port 2021.');
}

const provider = createAssinafyClientFactory(PRODUCTION_BASE_URL)(
  { kind: 'apiKey', apiKey, configuredAccountId: accountId },
  { accountId, maxRetries: 0 },
);
const runId = randomUUID();
const name = `Assinafy Twenty contract test ${runId}`;
const manifestDirectory = join(process.cwd(), '.twenty', 'production-contract-cleanup');
const manifestPath = join(manifestDirectory, `${runId}.json`);
type RootContract = Extract<ContractSummary, { kind: 'contract' }>;
const terms: ContractTerms = {
  status: 'active', counterparty_name: 'Empresa de teste de integração', value: 1200.5, currency: 'BRL',
  start_date: '2030-01-01', end_date: '2030-10-31', auto_renew: false, renewal_term_months: 12, notice_period_days: 30,
};
let app: E2eApp | null = null;
let token = '';
let documentId: string | null = null;
let documentRecordId = '';
let uploadAttempted = false;
let current: RootContract;

// Restrict the direct SDK client to this run's upload, metadata, cleanup and non-billable contract operations.
provider.getAxiosInstance().interceptors.request.use((request) => {
  const method = request.method?.toUpperCase();
  const path = request.url ?? '';
  const contractPath = `/accounts/${accountId}/documents/${documentId}/contract`;
  const allowed = (documentId === null && method === 'POST' && path === `/accounts/${accountId}/documents`) ||
    (documentId !== null && (['GET', 'DELETE'].includes(method ?? '') && path === `/documents/${documentId}` ||
      ['GET', 'PUT'].includes(method ?? '') && path === contractPath ||
      method === 'POST' && [`${contractPath}/renew`, `${contractPath}/terminate`].includes(path)));
  if (request.baseURL !== PRODUCTION_BASE_URL || !allowed) throw new Error('Unexpected production test operation');
  return request;
});

// Provider and client exceptions can contain headers or response bodies; test failures expose only codes and names.
// A cause would retain the original credential-bearing objects, so the replacement deliberately has none.
const safeFailure = (operation: string, error: unknown): Error =>
  new Error(`${operation} failed (${toAppError(error, 'read').code}; ${errorName(error)})`);

const safely = async <T>(operation: string, action: () => Promise<T>): Promise<T> => {
  try {
    return await action();
  } catch (error) {
    throw safeFailure(operation, error);
  }
};

const saveManifest = (cleanupCodes: string[] = []) => {
  mkdirSync(manifestDirectory, { recursive: true });
  writeFileSync(manifestPath, JSON.stringify({ runId, name, accountId, documentId, documentRecordId, uploadAttempted, cleanupCodes }, null, 2), { mode: 0o600 });
};

const requiredDocumentId = (): string => {
  if (!documentId) throw new Error('The production fixture has no document');
  return documentId;
};

const requiredApp = (): E2eApp => {
  if (!app) throw new Error('The local Twenty app is not installed');
  return app;
};

const call = (input: object) => safely('Local contract route', () => callRoute<{ contract: ContractSummary | null }>(
  '/s/assinafy/documents/contract', token, { documentRecordId, ...input },
));

const rootContract = async (input: object): Promise<RootContract> => {
  const result = await call(input);
  expect(result).toMatchObject({ ok: true, contract: { kind: 'contract' } });
  if (!result.ok || result.contract?.kind !== 'contract') throw new Error('The route did not return contract terms');
  return result.contract;
};

const row = async () => {
  const records = await safely('Read local contract record', () => findAssinafyDocuments(coreClient(USER_TOKEN), {
    filter: { id: { eq: documentRecordId } }, first: 1,
  }));
  if (records.length !== 1) throw new Error('The local contract fixture was not found');
  return records[0]!;
};

const rejectionStatus = async (operation: () => Promise<unknown>): Promise<number> => {
  try {
    await operation();
    return 200;
  } catch (error) {
    if (error instanceof ApiError) return error.statusCode;
    throw safeFailure('Production refusal check', error);
  }
};

// Seed a completed local signature fixture without requesting a production signature.
const seedLocalRecord = async () => {
  const timestamp = new Date().toISOString();
  const { createAssinafyDocument: created } = await safely<{ createAssinafyDocument?: { id: string } | null }>(
    'Create named local fixture',
    () => coreClient(USER_TOKEN).mutation({ createAssinafyDocument: { __args: { data: { name } }, id: true } }),
  );
  documentRecordId = created?.id ?? '';
  const table = await safely('Locate test object', findAssinafyDocumentTable);
  if (!/^[a-f0-9-]{36}$/.test(documentRecordId)) {
    throw new Error('Unexpected local fixture location');
  }
  await safely('Seed local fixture fields', () => psql(`update ${table} set
    status = 'CERTIFICATED', "requestId" = '${runId}', "assinafyDocumentId" = '${requiredDocumentId()}',
    "assinafyAccountId" = '${accountId}', "sentAt" = '${timestamp}', "completedAt" = '${timestamp}',
    "signerCount" = 0, "signedCount" = 0 where id = '${documentRecordId}'`));
};

beforeAll(async () => {
  app = await safely('Find local app', findE2eApp);
  token = await safely('Read front component token', () => frontEndToken(requiredApp()));
  await safely('Disable webhook registration', () => setAppVariable(requiredApp(), ASSINAFY_WEBHOOK_EMAIL_VARIABLE, ''));
  await safely('Set production account', () => setAppVariable(requiredApp(), ASSINAFY_ACCOUNT_ID_VARIABLE, accountId));
  await safely('Set production key', () => setAppVariable(requiredApp(), ASSINAFY_API_KEY_VARIABLE, apiKey));
  await safely('Wait for local app credentials', () => waitForHealthStatus(requiredApp(), 'OK', 'production account configuration'));
  uploadAttempted = true;
  saveManifest();
  const uploaded = await safely('Upload synthetic PDF', () => provider.documents.upload(
    { buffer: buildPdf('Synthetic contract integration fixture. No signatures requested.'), fileName: `${runId}.pdf` },
    { name },
  ));
  if (!isAssinafyId(uploaded.id)) throw new Error('The production upload returned an invalid document ID');
  documentId = uploaded.id;
  saveManifest();
  await safely('Wait for unsent PDF processing', () => poll(async () => {
    const details = await provider.documents.details(requiredDocumentId());
    if (details.account_id !== accountId || !isUnsentDocument(details)) throw new Error('Unexpected uploaded document state');
    return details.status.toLowerCase();
  }, (status) => status === 'metadata_ready', { timeoutMs: 90_000, intervalMs: 2_000, label: 'synthetic PDF metadata' }));
  await seedLocalRecord();
  saveManifest();
});

afterAll(async () => {
  const cleanupCodes: string[] = [];
  // A lost upload response may leave a provider document whose ID never arrived. Keep its unique name for recovery.
  if (uploadAttempted && documentId === null) cleanupCodes.push('UPLOAD_OUTCOME_UNKNOWN');
  if (app) {
    for (const key of [ASSINAFY_API_KEY_VARIABLE, ASSINAFY_ACCOUNT_ID_VARIABLE]) {
      await setAppVariable(app, key, '').catch(() => { cleanupCodes.push('LOCAL_CREDENTIAL_CLEAR_FAILED'); });
    }
    await waitForHealthStatus(app, 'WARNING', 'removed production credentials')
      .catch(() => { cleanupCodes.push('LOCAL_CREDENTIAL_CLEAR_UNCONFIRMED'); });
  }
  if (documentId) {
    try {
      const details = await provider.documents.details(documentId);
      if (details.account_id !== accountId || !isUnsentDocument(details)) cleanupCodes.push('DOCUMENT_NOT_OWN_UNSENT_UPLOAD');
      else await provider.documents.delete(documentId);
    } catch (error) {
      if (!(error instanceof ApiError && error.statusCode === 404)) cleanupCodes.push(`PROVIDER_CLEANUP_${toAppError(error, 'read').code}`);
    }
  }
  if (cleanupCodes.length > 0) {
    saveManifest(cleanupCodes);
    throw new Error(`Production test cleanup incomplete (${cleanupCodes.join(', ')}). Fixture IDs retained in ${manifestPath}.`);
  }
  rmSync(manifestPath, { force: true });
});

describe('installed app contract lifecycle against production without requesting signatures', () => {
  it('reads absence, creates terms and mirrors them on the local certified fixture', async () => {
    expect(await call({ action: 'get' })).toEqual({ ok: true, contract: null });
    current = await rootContract({ action: 'set', updatedAt: null, terms });
    expect(current).toMatchObject({ ...terms, kind: 'contract', term: 1 });
    expect(await row()).toMatchObject({ status: 'CERTIFICATED', contractStatus: 'ACTIVE', contractDetails: current });
  });

  it('edits reviewed terms and refuses a stale edit', async () => {
    const reviewed = current;
    current = await rootContract({ action: 'set', updatedAt: reviewed.updatedAt, terms: { ...terms, value: 2300 } });
    expect(current.value).toBe(2300);
    expect(await call({ action: 'set', updatedAt: reviewed.updatedAt, terms }))
      .toMatchObject({ ok: false, error: { code: 'CONTRACT_CHANGED' } });
  });

  it('enforces production revision conflicts and does not copy private provider fields into Twenty', async () => {
    const reviewed = current;
    await safely('Change provider contract terms', () => provider.contracts.set(requiredDocumentId(), {
      value: 3400, metadata: { test_run: runId }, updated_at: reviewed.updatedAt,
    }));
    expect(await rejectionStatus(() => provider.contracts.set(requiredDocumentId(), { value: 1, updated_at: reviewed.updatedAt }))).toBe(409);
    expect(await call({ action: 'set', updatedAt: reviewed.updatedAt, terms }))
      .toMatchObject({ ok: false, error: { code: 'CONTRACT_CHANGED' } });
    current = await rootContract({ action: 'get' });
    expect(current.value).toBe(3400);
    for (const value of [current, (await row()).contractDetails]) {
      for (const field of ['counterparty_taxpayer_id', 'owner_id', 'metadata', 'external_references', 'amendments']) {
        expect(value).not.toHaveProperty(field);
      }
    }
  });

  it('renews one term and safely refuses the repeated original term', async () => {
    const reviewed = current;
    current = await rootContract({ action: 'renew', updatedAt: reviewed.updatedAt, term: reviewed.term });
    expect(current).toMatchObject({ status: 'active', term: reviewed.term + 1, end_date: '2031-10-31' });
    expect(await rejectionStatus(() => provider.contracts.renew(requiredDocumentId(), { term: reviewed.term }))).toBe(400);
    expect(await call({ action: 'renew', updatedAt: reviewed.updatedAt, term: reviewed.term }))
      .toMatchObject({ ok: false, error: { code: 'CONTRACT_CHANGED' } });
    expect((await rootContract({ action: 'get' })).term).toBe(current.term);
  });

  it('polls an out-of-band contract change without altering the final signature fixture', async () => {
    await safely('Update provider terms for polling', () => provider.contracts.set(requiredDocumentId(), {
      value: 4500, updated_at: current.updatedAt,
    }));
    expect((await row()).contractDetails).toMatchObject({ value: 3400 });
    const counts = await safely('Run contract polling', () => runSyncCron(requiredApp()));
    expect(counts.synced).toBe(1);
    expect(await row()).toMatchObject({ status: 'CERTIFICATED', contractStatus: 'ACTIVE', contractDetails: { value: 4500 } });
    current = await rootContract({ action: 'get' });
  });

  it('terminates the contract and confirms the provider document still has no assignment', async () => {
    current = await rootContract({ action: 'terminate', updatedAt: current.updatedAt, reason: 'Encerramento do teste de integração' });
    expect(current.status).toBe('terminated');
    expect(await row()).toMatchObject({ status: 'CERTIFICATED', contractStatus: 'TERMINATED', contractDetails: current });
    const details = await safely('Verify unsent production fixture', () => provider.documents.details(requiredDocumentId()));
    expect(details.account_id === accountId && isUnsentDocument(details)).toBe(true);
  });
});
