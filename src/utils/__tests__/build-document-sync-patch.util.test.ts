import { type IAssignment, type IDocumentDetailsResponse } from '@assinafy/sdk';
import { describe, expect, it } from 'vitest';

import { NOW } from 'src/__tests__/fixtures/build-context';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { buildStoredSigner } from 'src/__tests__/fixtures/build-stored-signer';
import { PROVIDER_MESSAGE_MAX_LENGTH } from 'src/constants/limits';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { buildDocumentSyncPatch } from 'src/utils/build-document-sync-patch.util';

const UPDATED_AT = '2026-09-25T11:00:00.000Z';

const record = (overrides: Partial<AssinafyDocumentRecord> = {}): AssinafyDocumentRecord =>
  buildDocumentRecord({
    id: 'record-1',
    assinafyAccountId: 'account-1',
    assinafyAssignmentId: 'assignment-1',
    requestId: 'request-1',
    signerCount: 2,
    signers: [buildStoredSigner(), buildStoredSigner({ id: 'signer-2', email: 'bruno@example.invalid' })],
    sentAt: '2026-09-01T10:00:00.000Z',
    personId: 'person-1',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  });

const assignment = (overrides: Partial<IAssignment> = {}): IAssignment => ({
  id: 'assignment-1',
  method: 'virtual',
  expires_at: '2026-10-01T00:00:00.000Z',
  signers: [
    {
      id: 'signer-1',
      full_name: 'Ana Souza',
      email: 'ana@example.invalid',
      verification_method: 'Email',
      notification_methods: ['Email'],
      step: null,
      notified: true,
      completed: true,
    },
    {
      id: 'signer-2',
      full_name: 'Bruno Lima',
      email: 'bruno@example.invalid',
      verification_method: 'Email',
      notification_methods: ['Email'],
      step: null,
      notified: true,
      completed: false,
    },
  ],
  summary: { signer_count: 2, completed_count: 1, signers: [] },
  ...overrides,
});

const details = (overrides: Partial<IDocumentDetailsResponse> = {}): IDocumentDetailsResponse => ({
  id: 'doc-1',
  account_id: 'account-1',
  name: 'Service agreement.pdf',
  status: 'pending_signature',
  assignment: assignment(),
  pages: [],
  created_at: '2026-09-01T10:00:00.000Z',
  updated_at: UPDATED_AT,
  is_closed: false,
  decline_reason: null,
  ...overrides,
});

const build = (
  input: Partial<Parameters<typeof buildDocumentSyncPatch>[0]> = {},
): ReturnType<typeof buildDocumentSyncPatch> =>
  buildDocumentSyncPatch({
    record: record(),
    details: details(),
    storedFiles: null,
    allArtifactsStored: false,
    now: NOW,
    ...input,
  });

describe('buildDocumentSyncPatch', () => {
  it('refreshes a pending document', () => {
    expect(build()).toEqual({
      status: 'PENDING_SIGNATURE',
      assinafyAssignmentId: 'assignment-1',
      signers: [
        buildStoredSigner({ completed: true }),
        buildStoredSigner({ id: 'signer-2', name: 'Bruno Lima', email: 'bruno@example.invalid' }),
      ],
      signerCount: 2,
      signedCount: 1,
      expiresAt: '2026-10-01T00:00:00.000Z',
      declineReason: null,
      completedAt: null,
      lastSyncedAt: NOW.toISOString(),
      lastError: null,
    });
  });

  it.each(['uploaded', 'metadata_processing', 'metadata_ready'])(
    'maps the draft status %o of a sent record to PENDING_SIGNATURE',
    (status) => {
      expect(build({ details: details({ status }) }).status).toBe('PENDING_SIGNATURE');
      expect(
        build({
          record: record({ sentAt: null, assinafyAssignmentId: null, status: 'UNCERTAIN' }),
          details: details({ status }),
        }).status,
      ).toBe('PENDING_SIGNATURE');
      expect(
        build({
          record: record({ sentAt: '2026-09-01T10:00:00.000Z', assinafyAssignmentId: null }),
          details: details({ status, assignment: null }),
        }).status,
      ).toBe('PENDING_SIGNATURE');
      expect(
        build({
          record: record({ sentAt: null, assinafyAssignmentId: 'assignment-1' }),
          details: details({ status, assignment: null }),
        }).status,
      ).toBe('PENDING_SIGNATURE');
    },
  );

  it('leaves an unsent draft UNCERTAIN for the caller to resolve', () => {
    const patch = build({
      record: record({ status: 'UNCERTAIN', sentAt: null, assinafyAssignmentId: null }),
      details: details({ status: 'uploaded', assignment: null }),
    });
    expect(patch.status).toBe('UNCERTAIN');
  });

  it.each(['CERTIFICATED', 'REJECTED_BY_SIGNER', 'CANCELLED', 'FAILED'] as const)(
    'never leaves the final status %s but refreshes counts',
    (status) => {
      const patch = build({
        record: record({ status, completedAt: '2026-09-10T00:00:00.000Z', lastError: 'NOT_SENT' }),
        details: details({ status: 'pending_signature' }),
      });
      expect(patch.status).toBe(status);
      expect(patch).toMatchObject({ signerCount: 2, completedAt: '2026-09-10T00:00:00.000Z' });
      expect(patch).not.toHaveProperty('lastError');
    },
  );

  it('lets EXPIRED return to PENDING_SIGNATURE', () => {
    expect(build({ record: record({ status: 'EXPIRED' }) }).status).toBe('PENDING_SIGNATURE');
  });

  it('marks CERTIFICATED when every artifact is stored', () => {
    const storedFiles = [{ fileId: 'file-1', label: 'Service agreement - assinado.pdf' }];
    const patch = build({ details: details({ status: 'certificated' }), storedFiles, allArtifactsStored: true });
    expect(patch).toMatchObject({
      status: 'CERTIFICATED',
      signedCount: 2,
      signerCount: 2,
      signedDocument: storedFiles,
      completedAt: UPDATED_AT,
      lastError: null,
    });
  });

  it('stays CERTIFICATING with SIGNED_FILES_PENDING until every artifact is stored', () => {
    const storedFiles = [{ fileId: 'file-1', label: 'Service agreement - assinado.pdf' }];
    const patch = build({ details: details({ status: 'certificated' }), storedFiles, allArtifactsStored: false });
    expect(patch).toMatchObject({
      status: 'CERTIFICATING',
      signedCount: 1,
      signedDocument: storedFiles,
      completedAt: null,
      lastError: 'SIGNED_FILES_PENDING',
    });
  });

  it('keeps stored signers, counts and assignment id when Assinafy returns no assignment', () => {
    const patch = build({ details: details({ assignment: null }) });
    expect(patch).toEqual({
      status: 'PENDING_SIGNATURE',
      declineReason: null,
      completedAt: null,
      lastSyncedAt: NOW.toISOString(),
      lastError: null,
    });
  });

  it('uses the stored signer count for a certificated document without an assignment', () => {
    const patch = build({
      details: details({ status: 'certificated', assignment: null }),
      allArtifactsStored: true,
    });
    expect(patch).toMatchObject({ status: 'CERTIFICATED', signedCount: 2 });
    expect(patch).not.toHaveProperty('signerCount');
  });

  it('counts from signers when the summary is missing', () => {
    const { summary: _summary, ...withoutSummary } = assignment();
    expect(build({ details: details({ assignment: withoutSummary }) })).toMatchObject({
      signerCount: 2,
      signedCount: 1,
    });
  });

  it('keeps the previous completed value when Assinafy omits it', () => {
    const { summary: _summary, ...base } = assignment();
    const omitted = { ...base, signers: base.signers.map(({ completed: _completed, ...signer }) => signer) };
    const patch = build({
      record: record({ signers: [buildStoredSigner({ completed: true }), buildStoredSigner({ id: 'signer-2', completed: null })] }),
      details: details({ assignment: omitted }),
    });
    expect(patch.signers?.map((signer) => signer.completed)).toEqual([true, null]);
    expect(patch.signedCount).toBe(1);
  });

  it('writes expiresAt only when the assignment reports it', () => {
    const { expires_at: _expiresAt, ...withoutExpiry } = assignment();
    expect(build({ details: details({ assignment: withoutExpiry }) })).not.toHaveProperty('expiresAt');
    expect(build({ details: details({ assignment: assignment({ expires_at: null }) }) }).expiresAt).toBeNull();
  });

  it('records a decline reason and the completion time on rejection', () => {
    const patch = build({ details: details({ status: 'rejected_by_signer', decline_reason: 'Wrong amount' }) });
    expect(patch).toMatchObject({
      status: 'REJECTED_BY_SIGNER',
      declineReason: 'Wrong amount',
      completedAt: UPDATED_AT,
    });
  });

  it('marks the signer Assinafy reports as declined_by', () => {
    const patch = build({
      details: details({
        status: 'rejected_by_signer',
        declined_by: { id: 'signer-2', full_name: 'Bruno Lima', email: 'bruno@example.invalid' },
      }),
    });
    expect(patch.signers?.map((signer) => signer.declined)).toEqual([false, true]);
  });

  it('keeps the stored declined flag when Assinafy does not say who declined', () => {
    const patch = build({
      record: record({ signers: [buildStoredSigner(), buildStoredSigner({ id: 'signer-2', declined: true })] }),
      details: details({ status: 'rejected_by_signer', declined_by: null }),
    });
    expect(patch.signers?.map((signer) => signer.declined)).toEqual([false, true]);
  });

  it('redacts contacts, links and government ids from the decline reason', () => {
    const patch = build({
      details: details({
        status: 'rejected_by_signer',
        decline_reason: 'CPF 123.456.789-00, veja https://sign.test.invalid/secret e fale com a@b.test',
      }),
    });
    expect(patch.declineReason).toBe('CPF [número], veja [link] e fale com [e-mail]');
  });

  it('caps the decline reason at the provider message length', () => {
    const patch = build({ details: details({ status: 'rejected_by_signer', decline_reason: 'x'.repeat(5000) }) });
    expect(patch.declineReason).toHaveLength(PROVIDER_MESSAGE_MAX_LENGTH);
    expect(patch.declineReason?.endsWith('…')).toBe(true);
  });

  it('cleans a decline reason stored before the redaction', () => {
    const patch = build({
      record: record({ status: 'REJECTED_BY_SIGNER', declineReason: 'CPF 123.456.789-00' }),
      details: details({ status: 'rejected_by_signer', decline_reason: null }),
    });
    expect(patch.declineReason).toBe('CPF [número]');
  });

  it.each([null, undefined, '', '   '])('never overwrites a decline reason with %o', (declineReason) => {
    const patch = build({
      record: record({ status: 'REJECTED_BY_SIGNER', declineReason: 'Wrong amount' }),
      details: details({ status: 'rejected_by_signer', decline_reason: declineReason }),
    });
    expect(patch.declineReason).toBe('Wrong amount');
  });

  it('sets completedAt once', () => {
    const patch = build({
      record: record({ status: 'CERTIFICATING', completedAt: '2026-09-20T00:00:00.000Z' }),
      details: details({ status: 'certificated' }),
      allArtifactsStored: true,
    });
    expect(patch.completedAt).toBe('2026-09-20T00:00:00.000Z');
  });

  it('falls back to now for completedAt when Assinafy has no update time', () => {
    const patch = build({ details: details({ status: 'failed', updated_at: '' }) });
    expect(patch).toMatchObject({ status: 'FAILED', completedAt: NOW.toISOString() });
  });

  it('does not set completedAt for expired documents', () => {
    expect(build({ details: details({ status: 'expired' }) })).toMatchObject({ status: 'EXPIRED', completedAt: null });
  });

  it('maps an unknown Assinafy status to UNKNOWN', () => {
    expect(build({ details: details({ status: 'archived' }) }).status).toBe('UNKNOWN');
  });
});
