import { ApiError } from '@assinafy/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContext, NOW } from 'src/__tests__/fixtures/build-context';
import { CONTRACT_TERMS, CONTRACT_UPDATED_AT } from 'src/__tests__/fixtures/build-contract';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import { buildResolved } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { readAssinafyContract } from 'src/services/read-assinafy-contract.service';
import { storeContractSummary } from 'src/services/store-contract-summary.service';
import { syncAssinafyContract } from 'src/services/sync-assinafy-contract.service';
import { type ContractSummary } from 'src/types/contract-summary';

vi.mock('src/data/update-assinafy-document', () => ({ updateAssinafyDocument: vi.fn<typeof updateAssinafyDocument>() }));
vi.mock('src/services/read-assinafy-contract.service', () => ({ readAssinafyContract: vi.fn<typeof readAssinafyContract>() }));
vi.mock('src/services/store-contract-summary.service', () => ({ storeContractSummary: vi.fn<typeof storeContractSummary>() }));

const contract: ContractSummary = { ...CONTRACT_TERMS, kind: 'contract', term: 1, updatedAt: CONTRACT_UPDATED_AT };
const resolved = buildResolved({}, 'acc-1');
const record = buildDocumentRecord({ status: 'CERTIFICATED' });

describe('syncAssinafyContract', () => {
  beforeEach(() => {
    vi.mocked(readAssinafyContract).mockResolvedValue(contract);
    vi.mocked(storeContractSummary).mockResolvedValue(undefined);
    vi.mocked(updateAssinafyDocument).mockResolvedValue(record);
  });

  it('refreshes contract terms independently of the signature status', async () => {
    const ctx = buildContext();

    await expect(syncAssinafyContract(ctx, record, resolved)).resolves.toEqual(contract);

    expect(readAssinafyContract).toHaveBeenCalledExactlyOnceWith(resolved.client, 'doc-1');
    expect(storeContractSummary).toHaveBeenCalledExactlyOnceWith(ctx, record.id, contract);
    expect(updateAssinafyDocument).not.toHaveBeenCalled();
  });

  it('clears stale contract terms when Assinafy no longer has them', async () => {
    vi.mocked(readAssinafyContract).mockResolvedValue(null);
    const ctx = buildContext();

    await expect(syncAssinafyContract(ctx, record, resolved)).resolves.toBeNull();

    expect(storeContractSummary).toHaveBeenCalledExactlyOnceWith(ctx, record.id, null);
  });

  it.each([
    { assinafyDocumentId: null },
    { assinafyDocumentId: '' },
    { assinafyAccountId: null },
    { assinafyAccountId: 'acc-2' },
  ])('refuses an unbound or mismatched document before any read or write (%o)', async (patch) => {
    await expect(syncAssinafyContract(buildContext(), { ...record, ...patch }, resolved))
      .rejects.toMatchObject({ code: 'INVALID_STATE' });

    expect(readAssinafyContract).not.toHaveBeenCalled();
    expect(storeContractSummary).not.toHaveBeenCalled();
    expect(updateAssinafyDocument).not.toHaveBeenCalled();
  });

  it('rotates a provider failure without changing the last known contract or signature state', async () => {
    vi.mocked(readAssinafyContract).mockRejectedValue(new ApiError('Rate limited', 429));
    const ctx = buildContext();

    await expect(syncAssinafyContract(ctx, record, resolved)).rejects.toMatchObject({ code: 'RATE_LIMITED' });

    expect(storeContractSummary).not.toHaveBeenCalled();
    expect(updateAssinafyDocument).toHaveBeenCalledExactlyOnceWith(ctx.appCore, record.id, { contractSyncedAt: NOW.toISOString() });
  });

  it('preserves the provider failure if rotating the timestamp also fails', async () => {
    vi.mocked(readAssinafyContract).mockRejectedValue(new ApiError('Permission refused', 403));
    vi.mocked(updateAssinafyDocument).mockRejectedValue(new Error('Storage unavailable'));

    await expect(syncAssinafyContract(buildContext(), record, resolved)).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('maps a failed contract write and tries to rotate its next polling turn', async () => {
    vi.mocked(storeContractSummary).mockRejectedValue(new Error('Storage unavailable'));
    const ctx = buildContext();

    await expect(syncAssinafyContract(ctx, record, resolved)).rejects.toMatchObject({ code: 'INTERNAL' });

    expect(updateAssinafyDocument).toHaveBeenCalledExactlyOnceWith(ctx.appCore, record.id, { contractSyncedAt: NOW.toISOString() });
  });
});
