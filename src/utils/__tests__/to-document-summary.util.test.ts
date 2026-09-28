import { describe, expect, it } from 'vitest';

import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { toDocumentSummary } from 'src/utils/to-document-summary.util';

const record: AssinafyDocumentRecord = {
  id: 'record-1',
  name: 'Service agreement',
  status: 'REJECTED_BY_SIGNER',
  assinafyDocumentId: 'doc-1',
  assinafyAccountId: 'account-1',
  assinafyAssignmentId: 'assignment-1',
  requestId: 'request-1',
  templateName: null,
  signerCount: 2,
  signedCount: 1,
  signers: [
    {
      id: 'signer-1',
      name: 'Ana Souza',
      email: 'ana@example.invalid',
      phone: null,
      verificationMethod: 'Email',
      notificationMethod: 'Email',
      step: null,
      notified: true,
      completed: true,
      deliveryFailed: false,
      declined: false,
    },
    {
      id: 'signer-2',
      name: 'Bruno Lima',
      email: 'bruno@example.invalid',
      phone: null,
      verificationMethod: 'Email',
      notificationMethod: 'Email',
      step: null,
      notified: true,
      completed: false,
      deliveryFailed: false,
      declined: true,
    },
  ],
  sentAt: '2026-09-01T10:00:00.000Z',
  completedAt: '2026-09-02T10:00:00.000Z',
  expiresAt: null,
  lastSyncedAt: '2026-09-02T10:05:00.000Z',
  declineReason: 'Wrong amount',
  lastError: null,
  signedDocument: null,
  personId: 'person-1',
  companyId: null,
  opportunityId: null,
  updatedAt: '2026-09-02T10:05:00.000Z',
};

describe('toDocumentSummary', () => {
  it('summarizes a record', () => {
    expect(toDocumentSummary(record)).toEqual({
      documentRecordId: 'record-1',
      status: 'REJECTED_BY_SIGNER',
      name: 'Service agreement',
      signerCount: 2,
      signedCount: 1,
      signers: record.signers,
      declineReason: 'Wrong amount',
      sentAt: '2026-09-01T10:00:00.000Z',
      completedAt: '2026-09-02T10:00:00.000Z',
      expiresAt: null,
      lastSyncedAt: '2026-09-02T10:05:00.000Z',
      lastError: null,
    });
  });

  it('defaults missing values', () => {
    expect(
      toDocumentSummary({ ...record, status: null, signerCount: null, signedCount: null, signers: null }),
    ).toMatchObject({ status: 'UNKNOWN', signerCount: 0, signedCount: 0, signers: [] });
  });
});
