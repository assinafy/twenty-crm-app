import { describe, expect, it } from 'vitest';

import { toAssinafyDocumentRecord } from 'src/data/to-assinafy-document-record';
import { buildContract } from 'src/__tests__/fixtures/build-contract';
import { toContractSummary } from 'src/utils/to-contract-summary.util';
import { type StoredSigner } from 'src/types/stored-signer';

const signer: StoredSigner = {
  id: 'signer-1',
  name: 'Ana Test',
  email: 'ana@example.invalid',
  phone: null,
  verificationMethod: 'Email',
  notificationMethod: 'Email',
  step: null,
  notified: true,
  completed: false,
  deliveryFailed: false,
  declined: false,
};

describe('toAssinafyDocumentRecord', () => {
  it.each([
    { sentAt: '2026-01-01T00:00:00.000Z', assinafyAssignmentId: null },
    { sentAt: null, assinafyAssignmentId: 'assignment-1' },
  ])('reopens a legacy provider failure with send evidence (%#)', (evidence) => {
    for (const lastError of [null, '']) {
      expect(toAssinafyDocumentRecord({
        id: 'record-1', updatedAt: '2026-01-02T00:00:00.000Z', status: 'FAILED',
        completedAt: '2026-01-02T00:00:00.000Z', lastError, ...evidence,
      })).toMatchObject({ status: 'UNKNOWN', completedAt: null, lastError: 'DOCUMENT_PROCESSING_FAILED' });
    }
  });

  it.each([
    { lastError: 'NOT_SENT', sentAt: null, assinafyAssignmentId: null },
    { lastError: 'PROVIDER_REJECTED', sentAt: null, assinafyAssignmentId: null },
    { lastError: 'PROVIDER_REJECTED', sentAt: '2026-01-01T00:00:00.000Z', assinafyAssignmentId: 'assignment-1' },
    { lastError: null, sentAt: null, assinafyAssignmentId: '' },
  ])('keeps a failed send without evidence of a provider processing failure final (%#)', (fields) => {
    expect(toAssinafyDocumentRecord({
      id: 'record-1', updatedAt: '2026-01-02T00:00:00.000Z', status: 'FAILED', ...fields,
    }).status).toBe('FAILED');
  });

  it('keeps zero signer counts, the counts of every new send', () => {
    expect(
      toAssinafyDocumentRecord({ id: 'record-1', updatedAt: '2026-01-02T00:00:00.000Z', signerCount: 0, signedCount: 0 }),
    ).toMatchObject({ signerCount: 0, signedCount: 0 });
  });

  it('maps every field', () => {
    const node = {
      id: 'record-1',
      name: 'Contract',
      status: 'PENDING_SIGNATURE' as const,
      contractStatus: 'ACTIVE' as const,
      contractDetails: toContractSummary(buildContract(), 'doc-1'),
      contractSyncedAt: '2026-01-02T00:00:00.000Z',
      assinafyDocumentId: 'doc-1',
      assinafyAccountId: 'account-1',
      assinafyAssignmentId: 'assignment-1',
      requestId: 'request-1',
      templateName: 'NDA',
      signerCount: 2,
      signedCount: 1,
      signers: [signer],
      sentAt: '2026-01-01T00:00:00.000Z',
      completedAt: '2026-01-03T00:00:00.000Z',
      expiresAt: '2026-02-01T00:00:00.000Z',
      lastSyncedAt: '2026-01-02T00:00:00.000Z',
      declineReason: 'Wrong address',
      lastError: 'SIGNED_FILES_PENDING',
      signedDocument: [{ fileId: 'file-1', label: 'Contract - assinado.pdf', url: 'https://files.test.invalid/1' }],
      personId: 'person-1',
      companyId: 'company-1',
      opportunityId: 'opportunity-1',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };

    expect(toAssinafyDocumentRecord(node)).toEqual(node);
  });

  it('turns absent values into null', () => {
    expect(toAssinafyDocumentRecord({ id: 'record-1', updatedAt: '2026-01-02T00:00:00.000Z' })).toEqual({
      id: 'record-1',
      name: null,
      status: null,
      contractStatus: null,
      contractDetails: null,
      contractSyncedAt: null,
      assinafyDocumentId: null,
      assinafyAccountId: null,
      assinafyAssignmentId: null,
      requestId: null,
      templateName: null,
      signerCount: null,
      signedCount: null,
      signers: null,
      sentAt: null,
      completedAt: null,
      expiresAt: null,
      lastSyncedAt: null,
      declineReason: null,
      lastError: null,
      signedDocument: null,
      personId: null,
      companyId: null,
      opportunityId: null,
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('reads the empty strings Twenty returns for unset text fields as null', () => {
    const record = toAssinafyDocumentRecord({
      id: 'record-1',
      updatedAt: '2026-01-02T00:00:00.000Z',
      name: '',
      assinafyDocumentId: '',
      assinafyAccountId: '',
      assinafyAssignmentId: '',
      requestId: '',
      templateName: '',
      declineReason: '',
      lastError: '',
    });

    expect(record).toMatchObject({
      name: null,
      assinafyDocumentId: null,
      assinafyAccountId: null,
      assinafyAssignmentId: null,
      requestId: null,
      templateName: null,
      declineReason: null,
      lastError: null,
    });
  });

  it('ignores a non-array signers value and null file entries', () => {
    const record = toAssinafyDocumentRecord({
      id: 'record-1',
      updatedAt: '2026-01-02T00:00:00.000Z',
      signers: { unexpected: true },
      signedDocument: [null, { fileId: 'file-1', label: 'a.pdf' }],
    });

    expect(record.signers).toBeNull();
    expect(record.signedDocument).toEqual([{ fileId: 'file-1', label: 'a.pdf', url: null }]);
  });
});
