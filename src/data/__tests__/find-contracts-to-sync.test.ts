import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';
import { findContractsToSync } from 'src/data/find-contracts-to-sync';

describe('findContractsToSync', () => {
  it('polls tracked contracts independently of signature status and age, oldest checks first', async () => {
    const { core, query } = fakeCore({
      assinafyDocuments: {
        edges: [{ node: { id: 'contract-record', status: 'CERTIFICATED', updatedAt: '2025-01-01T00:00:00.000Z' } }],
      },
    });

    const records = await findContractsToSync(core, 50);

    expect(query).toHaveBeenCalledWith({
      assinafyDocuments: {
        __args: {
          filter: {
            contractStatus: { is: 'NOT_NULL' },
            and: [
              { assinafyDocumentId: { is: 'NOT_NULL' } },
              { assinafyDocumentId: { neq: '' } },
              { assinafyAccountId: { is: 'NOT_NULL' } },
              { assinafyAccountId: { neq: '' } },
            ],
          },
          orderBy: [{ contractSyncedAt: 'AscNullsFirst' }],
          first: 50,
        },
        edges: { node: ASSINAFY_DOCUMENT_SELECTION },
      },
    });
    expect(records.map(({ id }) => id)).toEqual(['contract-record']);
  });
});
