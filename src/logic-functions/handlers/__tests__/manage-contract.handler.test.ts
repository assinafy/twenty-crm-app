import { ApiError, NetworkError } from '@assinafy/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { buildContract, CONTRACT_TERMS, CONTRACT_UPDATED_AT } from 'src/__tests__/fixtures/build-contract';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { selectDocumentCredential } from 'src/assinafy-client/select-document-credential';
import { assertCanUpdateAssinafyDocument } from 'src/data/assert-can-update-assinafy-document';
import { requireAssinafyDocument } from 'src/data/require-assinafy-document';
import { manageContractHandler } from 'src/logic-functions/handlers/manage-contract.handler';
import { buildResolved, DOCUMENT_RECORD_ID } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { storeContractSummary } from 'src/services/store-contract-summary.service';
import { type ContractInput } from 'src/types/contract-input';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { AppFailure } from 'src/utils/app-failure.util';
import { toContractSummary } from 'src/utils/to-contract-summary.util';

vi.mock('src/assinafy-client/select-document-credential', () => ({ selectDocumentCredential: vi.fn<typeof selectDocumentCredential>() }));
vi.mock('src/data/assert-can-update-assinafy-document', () => ({ assertCanUpdateAssinafyDocument: vi.fn<typeof assertCanUpdateAssinafyDocument>() }));
vi.mock('src/data/require-assinafy-document', () => ({ requireAssinafyDocument: vi.fn<typeof requireAssinafyDocument>() }));
vi.mock('src/services/store-contract-summary.service', () => ({ storeContractSummary: vi.fn<typeof storeContractSummary>() }));

const contracts = {
  get: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  set: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  renew: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
  terminate: vi.fn<(...args: unknown[]) => Promise<unknown>>(),
};
const resolved = buildResolved({ contracts });
const get: ContractInput = { documentRecordId: DOCUMENT_RECORD_ID, action: 'get' };
const set: ContractInput = { ...get, action: 'set', updatedAt: CONTRACT_UPDATED_AT, terms: CONTRACT_TERMS };
const renew: ContractInput = { ...get, action: 'renew', updatedAt: CONTRACT_UPDATED_AT, term: 1 };
const terminate: ContractInput = { ...get, action: 'terminate', updatedAt: CONTRACT_UPDATED_AT, reason: 'Fim do acordo' };
const ctx = () => buildContext({ createAssinafyClient: vi.fn<() => typeof resolved.client>(() => resolved.client) }) as MemberHandlerContext;

beforeEach(() => {
  vi.mocked(requireAssinafyDocument).mockResolvedValue(buildDocumentRecord());
  vi.mocked(selectDocumentCredential).mockResolvedValue(resolved);
  vi.mocked(assertCanUpdateAssinafyDocument).mockResolvedValue(undefined);
  vi.mocked(storeContractSummary).mockResolvedValue(undefined);
  for (const method of Object.values(contracts)) method.mockResolvedValue(buildContract());
});

describe('manageContractHandler', () => {
  it('reads only a member-visible document and mirrors the sanitized current terms as the app', async () => {
    const context = ctx();
    const summary = toContractSummary(buildContract(), 'doc-1');
    await expect(manageContractHandler(get, context)).resolves.toEqual({ contract: summary });
    expect(requireAssinafyDocument).toHaveBeenCalledWith(context.userCore, DOCUMENT_RECORD_ID);
    expect(assertCanUpdateAssinafyDocument).not.toHaveBeenCalled();
    expect(context.createAssinafyClient).toHaveBeenCalledWith(resolved.credential, { accountId: 'acc-1', maxRetries: 0 });
    expect(storeContractSummary).toHaveBeenCalledWith(context, DOCUMENT_RECORD_ID, summary);
  });

  it.each([{ sentAt: null }, { assinafyDocumentId: null }, { assinafyAccountId: null }])('refuses unconfirmed or unbound records', async (patch) => {
    vi.mocked(requireAssinafyDocument).mockResolvedValue(buildDocumentRecord(patch));
    await expect(manageContractHandler(set, ctx())).rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(selectDocumentCredential).not.toHaveBeenCalled();
  });

  it('never reaches Assinafy for unreadable records', async () => {
    vi.mocked(requireAssinafyDocument).mockRejectedValue(new AppFailure('NOT_FOUND', ''));
    await expect(manageContractHandler(get, ctx())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(selectDocumentCredential).not.toHaveBeenCalled();
  });

  it('requires update permission before selecting credentials or reading provider data on every mutation', async () => {
    vi.mocked(assertCanUpdateAssinafyDocument).mockRejectedValue(new AppFailure('FORBIDDEN', ''));
    for (const input of [set, renew, terminate]) {
      await expect(manageContractHandler(input, ctx())).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
    expect(selectDocumentCredential).not.toHaveBeenCalled();
    expect(contracts.get).not.toHaveBeenCalled();
  });

  it('represents missing tracked terms as null, then creates only with a null revision', async () => {
    contracts.get.mockRejectedValue(new ApiError('missing', 404));
    await expect(manageContractHandler(get, ctx())).resolves.toEqual({ contract: null });
    await manageContractHandler({ ...set, updatedAt: null }, ctx());
    expect(contracts.set).toHaveBeenCalledWith('doc-1', CONTRACT_TERMS);
  });

  it.each([set, renew, terminate])('refuses stale versions before changing anything: $action', async (input) => {
    contracts.get.mockResolvedValue(buildContract({ updated_at: '2026-10-28T12:00:01Z' }));
    await expect(manageContractHandler(input, ctx())).rejects.toMatchObject({ code: 'CONTRACT_CHANGED' });
    expect(contracts.set).not.toHaveBeenCalled();
    expect(contracts.renew).not.toHaveBeenCalled();
    expect(contracts.terminate).not.toHaveBeenCalled();
  });

  it('does not treat omitted revision as permission to overwrite existing terms', async () => {
    await expect(manageContractHandler({ ...set, updatedAt: null }, ctx())).rejects.toMatchObject({ code: 'CONTRACT_CHANGED' });
  });

  it('updates only the supported terms with the read revision', async () => {
    await manageContractHandler(set, ctx());
    expect(contracts.set).toHaveBeenCalledExactlyOnceWith('doc-1', { ...CONTRACT_TERMS, updated_at: CONTRACT_UPDATED_AT });
  });

  it('refuses active to draft transitions before a mutation', async () => {
    await expect(manageContractHandler({ ...set, terms: { ...CONTRACT_TERMS, status: 'draft' } }, ctx()))
      .rejects.toMatchObject({ code: 'INVALID_STATE' });
    expect(contracts.set).not.toHaveBeenCalled();
  });

  it('renews with both the current term and revision so a repeated action cannot renew twice', async () => {
    await manageContractHandler(renew, ctx());
    expect(contracts.renew).toHaveBeenCalledExactlyOnceWith('doc-1', { term: 1, updated_at: CONTRACT_UPDATED_AT });
  });

  it('terminates with the confirmed revision and reason', async () => {
    await manageContractHandler(terminate, ctx());
    expect(contracts.terminate).toHaveBeenCalledExactlyOnceWith('doc-1', { reason: 'Fim do acordo', updated_at: CONTRACT_UPDATED_AT });
  });

  it.each(['expired', 'terminated'] as const)('refuses direct edits to %s roots', async (status) => {
    contracts.get.mockResolvedValue(buildContract({ status }));
    await expect(manageContractHandler(set, ctx())).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it.each([renew, terminate])('refuses $action on terminated roots', async (input) => {
    contracts.get.mockResolvedValue(buildContract({ status: 'terminated' }));
    await expect(manageContractHandler(input, ctx())).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it.each([{ end_date: null }, { term: 2 }, { status: 'draft' as const }])('refuses renewal of an ineligible term', async (patch) => {
    contracts.get.mockResolvedValue(buildContract(patch));
    await expect(manageContractHandler(renew, ctx())).rejects.toMatchObject({ code: 'CONTRACT_CHANGED' });
    expect(contracts.renew).not.toHaveBeenCalled();
  });

  it('keeps an amendment read-only', async () => {
    contracts.get.mockResolvedValue({ resource: 'document_contract_amendment', document_id: 'doc-1', status: 'pending',
      relation_type: 'amendment', updated_at: CONTRACT_UPDATED_AT, applied_at: null });
    await expect(manageContractHandler(set, ctx())).rejects.toMatchObject({ code: 'INVALID_STATE' });
  });

  it.each([
    [new ApiError('conflict', 409), 'CONTRACT_CHANGED'],
    [new ApiError('plan', 403), 'CONTRACT_UNAVAILABLE'],
    [new ApiError('unauthorized', 401), 'RECONNECT_REQUIRED'],
    [new ApiError('rate', 429), 'RATE_LIMITED'],
    [new ApiError('bad', 400), 'PROVIDER_REJECTED'],
    [new ApiError('failed', 500), 'CONTRACT_UNCERTAIN'],
    [new NetworkError('lost reply'), 'CONTRACT_UNCERTAIN'],
    [new Error('unexpected'), 'CONTRACT_UNCERTAIN'],
  ])('maps mutation errors without retrying or switching credentials', async (error, code) => {
    contracts.set.mockRejectedValue(error);
    await expect(manageContractHandler(set, ctx())).rejects.toMatchObject({ code });
    expect(contracts.set).toHaveBeenCalledTimes(1);
    expect(selectDocumentCredential).toHaveBeenCalledTimes(1);
  });

  it('preserves insufficient-scope errors', async () => {
    const error = new ApiError('scope', 403);
    error.challenge = { scheme: 'Bearer', error: 'insufficient_scope', scope: 'documents:write' };
    contracts.set.mockRejectedValue(error);
    await expect(manageContractHandler(set, ctx())).rejects.toMatchObject({ code: 'INSUFFICIENT_SCOPE' });
  });

  it.each([null, { ...buildContract(), resource: 'unknown' }, { ...buildContract(), value: -1 }])('marks malformed mutation success as uncertain', async (answer) => {
    contracts.set.mockResolvedValue(answer);
    await expect(manageContractHandler(set, ctx())).rejects.toMatchObject({ code: 'CONTRACT_UNCERTAIN' });
  });

  it('does not claim a read outage changed the contract', async () => {
    contracts.get.mockRejectedValue(new NetworkError('unavailable'));
    await expect(manageContractHandler(set, ctx())).rejects.toMatchObject({ code: 'PROVIDER_UNAVAILABLE' });
    expect(contracts.set).not.toHaveBeenCalled();
  });

  it('returns confirmed provider success even if the mirror write fails', async () => {
    vi.mocked(storeContractSummary).mockRejectedValue(new Error('database unavailable'));
    await expect(manageContractHandler(set, ctx())).resolves.toMatchObject({ contract: { status: 'active' } });
    expect(contracts.set).toHaveBeenCalledTimes(1);
  });
});
