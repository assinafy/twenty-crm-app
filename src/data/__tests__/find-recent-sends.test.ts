import { describe, expect, it } from 'vitest';

import { LEGACY_PROCESSING_FAILURE_FILTER } from 'src/constants/document-status';
import { fakeCore } from 'src/data/__tests__/fake-core';
import { findRecentSends } from 'src/data/find-recent-sends';

const RECORD_ID = '0b8f5f7e-6d1c-4a55-9c43-1f5a3b2c9d10';
const SINCE = new Date('2026-09-25T11:00:00.000Z');

describe('findRecentSends', () => {
  it("reads the record's recent documents that may have been sent, selecting only id, name and status", async () => {
    const { core, query } = fakeCore({
      assinafyDocuments: {
        edges: [
          { node: { id: 'doc-record-1', name: 'Contrato', status: 'PENDING_SIGNATURE' } },
          { node: { id: 'doc-record-2', name: '', status: 'UNCERTAIN' } },
          { node: { id: 'doc-record-3', name: 'Proposta', status: null } },
          { node: { id: 'legacy-record', name: 'Contrato antigo', status: 'FAILED' } },
        ],
      },
    });

    await expect(findRecentSends(core, RECORD_ID, SINCE)).resolves.toEqual([
      { documentRecordId: 'doc-record-1', name: 'Contrato', status: 'PENDING_SIGNATURE' },
      { documentRecordId: 'doc-record-2', name: null, status: 'UNCERTAIN' },
      { documentRecordId: 'doc-record-3', name: 'Proposta', status: null },
      { documentRecordId: 'legacy-record', name: 'Contrato antigo', status: 'UNKNOWN' },
    ]);
    expect(query).toHaveBeenCalledExactlyOnceWith({
      assinafyDocuments: {
        __args: {
          filter: {
            and: [
              {
                or: [
                  { personId: { eq: RECORD_ID } },
                  { companyId: { eq: RECORD_ID } },
                  { opportunityId: { eq: RECORD_ID } },
                ],
              },
              {
                or: [{ status: {
                  in: [
                    'SENDING',
                    'PENDING_SIGNATURE',
                    'PENDING_IDENTITY_REVIEW',
                    'CERTIFICATING',
                    'CERTIFICATED',
                    'REJECTED_BY_SIGNER',
                    'CANCELLED',
                    'EXPIRED',
                    'UNCERTAIN',
                    'UNKNOWN',
                  ],
                } }, LEGACY_PROCESSING_FAILURE_FILTER],
              },
              { createdAt: { gte: '2026-09-25T11:00:00.000Z' } },
            ],
          },
          orderBy: [{ createdAt: 'DescNullsLast' }],
          first: 5,
        },
        edges: { node: { id: true, name: true, status: true } },
      },
    });
  });

  it('returns an empty list when the connection is missing', async () => {
    const { core } = fakeCore({ assinafyDocuments: null });

    await expect(findRecentSends(core, RECORD_ID, SINCE)).resolves.toEqual([]);
  });
});
