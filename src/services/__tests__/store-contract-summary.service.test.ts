import { describe, expect, it, vi } from 'vitest';

import { buildContext, NOW } from 'src/__tests__/fixtures/build-context';
import { CONTRACT_TERMS, CONTRACT_UPDATED_AT } from 'src/__tests__/fixtures/build-contract';
import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import { storeContractSummary } from 'src/services/store-contract-summary.service';
import { type ContractSummary } from 'src/types/contract-summary';

vi.mock('src/data/update-assinafy-document', () => ({ updateAssinafyDocument: vi.fn<typeof updateAssinafyDocument>() }));

describe('storeContractSummary', () => {
  it.each([
    ['draft', 'DRAFT'], ['active', 'ACTIVE'], ['expired', 'EXPIRED'], ['terminated', 'TERMINATED'],
  ] as const)('stores %s terms using only the application client and contract fields', async (status, storedStatus) => {
    const ctx = buildContext();
    const contract: ContractSummary = { ...CONTRACT_TERMS, kind: 'contract', status, term: 1, updatedAt: CONTRACT_UPDATED_AT };

    await storeContractSummary(ctx, 'record-1', contract);

    expect(updateAssinafyDocument).toHaveBeenCalledExactlyOnceWith(ctx.appCore, 'record-1', {
      contractStatus: storedStatus, contractDetails: contract, contractSyncedAt: NOW.toISOString(),
    });
  });

  it.each([['pending', 'AMENDMENT_PENDING'], ['applied', 'AMENDMENT_APPLIED']] as const)(
    'stores a %s amendment separately from signature status', async (status, storedStatus) => {
      const ctx = buildContext();
      const contract: ContractSummary = {
        kind: 'amendment', status, relationType: 'amendment', appliedAt: null, updatedAt: CONTRACT_UPDATED_AT,
      };

      await storeContractSummary(ctx, 'record-1', contract);

      expect(updateAssinafyDocument).toHaveBeenCalledExactlyOnceWith(ctx.appCore, 'record-1', {
        contractStatus: storedStatus, contractDetails: contract, contractSyncedAt: NOW.toISOString(),
      });
    },
  );

  it('clears both contract fields when terms are absent', async () => {
    const ctx = buildContext();

    await storeContractSummary(ctx, 'record-1', null);

    expect(updateAssinafyDocument).toHaveBeenCalledExactlyOnceWith(ctx.appCore, 'record-1', {
      contractStatus: null, contractDetails: null, contractSyncedAt: NOW.toISOString(),
    });
  });

  it('does not hide storage failures', async () => {
    const error = new Error('Storage unavailable');
    vi.mocked(updateAssinafyDocument).mockRejectedValue(error);

    await expect(storeContractSummary(buildContext(), 'record-1', null)).rejects.toBe(error);
  });
});
