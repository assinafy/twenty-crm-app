import { ApiError, type AssinafyClient } from '@assinafy/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContract, CONTRACT_TERMS, CONTRACT_UPDATED_AT } from 'src/__tests__/fixtures/build-contract';
import { readAssinafyContract } from 'src/services/read-assinafy-contract.service';

const get = vi.fn<AssinafyClient['contracts']['get']>();
const client = { contracts: { get } } as unknown as AssinafyClient;

describe('readAssinafyContract', () => {
  beforeEach(() => { get.mockResolvedValue(buildContract()); });

  it('reads the requested document and returns only the sanitized contract fields', async () => {
    const result = await readAssinafyContract(client, 'doc-1');

    expect(get).toHaveBeenCalledExactlyOnceWith('doc-1');
    expect(result).toEqual({ ...CONTRACT_TERMS, kind: 'contract', term: 1, updatedAt: CONTRACT_UPDATED_AT });
    expect(JSON.stringify(result)).not.toContain('11144477735');
    expect(result).not.toHaveProperty('metadata');
    expect(result).not.toHaveProperty('owner_id');
  });

  it('returns no contract when the provider reports no terms', async () => {
    get.mockRejectedValue(new ApiError('No contract terms', 404));

    await expect(readAssinafyContract(client, 'doc-1')).resolves.toBeNull();
  });

  it.each([new ApiError('Plan restricted', 403), new ApiError('Server error', 500), new TypeError('Malformed response')])(
    'does not treat a provider or parsing failure as missing contract terms (%s)', async (error) => {
      get.mockRejectedValue(error);

      await expect(readAssinafyContract(client, 'doc-1')).rejects.toBe(error);
    },
  );

  it('refuses a response that belongs to another document', async () => {
    get.mockResolvedValue(buildContract({ document_id: 'doc-2' }));

    await expect(readAssinafyContract(client, 'doc-1')).rejects.toMatchObject({ code: 'INTERNAL' });
  });
});
