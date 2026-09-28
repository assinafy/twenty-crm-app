import { ApiError, type AssinafyClient, NetworkError } from '@assinafy/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { buildStoredSigner } from 'src/__tests__/fixtures/build-stored-signer';
import { selectDocumentCredential } from 'src/assinafy-client/select-document-credential';
import { assertCanUpdateAssinafyDocument } from 'src/data/assert-can-update-assinafy-document';
import { findAssinafyDocument } from 'src/data/find-assinafy-document';
import { buildResolved, DOCUMENT_RECORD_ID } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { resendSignatureRequestHandler } from 'src/logic-functions/handlers/resend-signature-request.handler';
import { syncAssinafyDocument } from 'src/services/sync-assinafy-document.service';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { AppFailure } from 'src/utils/app-failure.util';
import { toDocumentSummary } from 'src/utils/to-document-summary.util';

vi.mock('src/assinafy-client/select-document-credential', () => ({ selectDocumentCredential: vi.fn<typeof selectDocumentCredential>() }));
vi.mock('src/data/assert-can-update-assinafy-document', () => ({
  assertCanUpdateAssinafyDocument: vi.fn<typeof assertCanUpdateAssinafyDocument>(),
}));
vi.mock('src/data/find-assinafy-document', () => ({ findAssinafyDocument: vi.fn<typeof findAssinafyDocument>() }));
vi.mock('src/services/sync-assinafy-document.service', () => ({ syncAssinafyDocument: vi.fn<typeof syncAssinafyDocument>() }));

const assertCanUpdate = vi.mocked(assertCanUpdateAssinafyDocument);
const findDocument = vi.mocked(findAssinafyDocument);
const selectCredential = vi.mocked(selectDocumentCredential);
const sync = vi.mocked(syncAssinafyDocument);

const estimateResendCost = vi.fn<(...ids: string[]) => Promise<unknown>>();
const resendNotification = vi.fn<AssinafyClient['assignments']['resendNotification']>();
const resolved = buildResolved({ assignments: { estimateResendCost, resendNotification } });

const rawEstimate = (overrides: Record<string, unknown> = {}) => ({
  documents: 0,
  total_credits: 0.45,
  credit_balance: 10,
  document_balance: 3,
  needs_extra_document: false,
  extra_document_cost: 0,
  has_sufficient_resources: true,
  blocking_reason: null,
  breakdown: [{ code: 'whatsapp', name: 'WhatsApp', cost: 0.45, quantity: 1 }],
  ...overrides,
});

const quote = { documentRecordId: DOCUMENT_RECORD_ID, signerId: 'signer-1', expectedTotalCredits: null };
const confirm = { ...quote, expectedTotalCredits: 0.45 };
// The logic function has already required a signed-in member.
const memberContext = () => buildContext() as MemberHandlerContext;

describe('resendSignatureRequestHandler', () => {
  let record: AssinafyDocumentRecord;

  beforeEach(() => {
    record = buildDocumentRecord();
    findDocument.mockResolvedValue(record);
    assertCanUpdate.mockResolvedValue(undefined);
    selectCredential.mockResolvedValue(resolved);
    estimateResendCost.mockResolvedValue(rawEstimate());
    resendNotification.mockResolvedValue({ is_sent: true, document_id: 'doc-1', signer_id: 'signer-1' });
    sync.mockImplementation(async (_ctx, current) => ({ ...current, lastSyncedAt: '2026-09-25T12:00:00.000Z' }));
  });

  describe('guards', () => {
    it('answers NOT_FOUND when the member cannot read the record', async () => {
      findDocument.mockResolvedValue(null);

      await expect(resendSignatureRequestHandler(quote, memberContext())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    });

    it.each<[string, Partial<AssinafyDocumentRecord>]>([
      ['the document is not waiting for signatures', { status: 'CERTIFICATING' }],
      ['the signer is unknown', { signers: [buildStoredSigner({ id: 'signer-2' })] }],
      ['the record has no signers', { signers: null }],
      ['the signer was never notified', { signers: [buildStoredSigner({ notified: false })] }],
      ['the signer notification state is unknown', { signers: [buildStoredSigner({ notified: null })] }],
      ['the signer already signed', { signers: [buildStoredSigner({ completed: true })] }],
      ['the assignment id is missing', { assinafyAssignmentId: null }],
      ['the Assinafy document id is missing', { assinafyDocumentId: null }],
      ['the Assinafy account is missing', { assinafyAccountId: null }],
    ])('answers INVALID_STATE without calling Assinafy when %s', async (_label, overrides) => {
      findDocument.mockResolvedValue(buildDocumentRecord(overrides));

      await expect(resendSignatureRequestHandler(confirm, memberContext())).rejects.toMatchObject({
        code: 'INVALID_STATE',
      });
      expect(assertCanUpdate).not.toHaveBeenCalled();
      expect(selectCredential).not.toHaveBeenCalled();
      expect(estimateResendCost).not.toHaveBeenCalled();
      expect(resendNotification).not.toHaveBeenCalled();
    });

    it.each([
      ['a quote', quote],
      ['a confirmed resend', confirm],
    ])('answers FORBIDDEN for %s without calling Assinafy when the member role cannot update the record', async (_label, request) => {
      const ctx = memberContext();
      assertCanUpdate.mockRejectedValue(new AppFailure('FORBIDDEN', 'Sua função no Twenty não permite alterar este documento.'));

      await expect(resendSignatureRequestHandler(request, ctx)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      expect(assertCanUpdate).toHaveBeenCalledWith(ctx.userCore, record);
      expect(selectCredential).not.toHaveBeenCalled();
      expect(estimateResendCost).not.toHaveBeenCalled();
      expect(resendNotification).not.toHaveBeenCalled();
    });

    it('allows a signer whose completion is unknown', async () => {
      findDocument.mockResolvedValue(buildDocumentRecord({ signers: [buildStoredSigner({ completed: null })] }));

      await expect(resendSignatureRequestHandler(quote, memberContext())).resolves.toHaveProperty('estimate');
    });
  });

  describe('quote (no expected cost)', () => {
    it('returns the normalized estimate and never resends', async () => {
      const ctx = memberContext();

      await expect(resendSignatureRequestHandler(quote, ctx)).resolves.toEqual({
        estimate: {
          documents: 0,
          totalCredits: 0.45,
          creditBalance: 10,
          documentBalance: 3,
          needsExtraDocument: false,
          extraDocumentCost: 0,
          sufficient: true,
          blockingReason: null,
        },
      });
      expect(findDocument).toHaveBeenCalledWith(ctx.userCore, DOCUMENT_RECORD_ID);
      expect(selectCredential).toHaveBeenCalledWith(ctx, 'acc-1');
      expect(estimateResendCost).toHaveBeenCalledWith('doc-1', 'asg-1', 'signer-1');
      expect(resendNotification).not.toHaveBeenCalled();
    });

    it('normalizes the legacy resend estimate shape', async () => {
      estimateResendCost.mockResolvedValue({ total: 0, breakdown: [], credit_balance: 0, has_sufficient_credits: false });

      await expect(resendSignatureRequestHandler(quote, memberContext())).resolves.toMatchObject({
        estimate: { totalCredits: 0, sufficient: false, blockingReason: 'InsufficientCredits' },
      });
    });

    it('returns an insufficient quote for the front end to explain', async () => {
      estimateResendCost.mockResolvedValue(rawEstimate({ has_sufficient_resources: false, blocking_reason: 'PendingPayment' }));

      await expect(resendSignatureRequestHandler(quote, memberContext())).resolves.toMatchObject({
        estimate: { sufficient: false, blockingReason: 'PendingPayment' },
      });
    });

    it('maps an estimate failure as a read (no UNCERTAIN: nothing was charged)', async () => {
      estimateResendCost.mockRejectedValue(new ApiError('Server error', 503));

      await expect(resendSignatureRequestHandler(confirm, memberContext())).rejects.toMatchObject({
        code: 'PROVIDER_UNAVAILABLE',
      });
      expect(resendNotification).not.toHaveBeenCalled();
    });
  });

  describe('confirmed resend', () => {
    it('resends exactly once at the confirmed cost, syncs and returns the summary', async () => {
      const ctx = memberContext();

      await expect(resendSignatureRequestHandler(confirm, ctx)).resolves.toEqual(
        toDocumentSummary({ ...record, lastSyncedAt: '2026-09-25T12:00:00.000Z' }),
      );
      expect(estimateResendCost).toHaveBeenCalledTimes(1);
      expect(resendNotification).toHaveBeenCalledTimes(1);
      expect(resendNotification).toHaveBeenCalledWith('doc-1', 'asg-1', 'signer-1');
      expect(sync).toHaveBeenCalledWith(ctx, record, resolved);
    });

    it('compares credits in cents, ignoring float noise', async () => {
      estimateResendCost.mockResolvedValue(rawEstimate({ total_credits: 0.1 + 0.35 }));

      await expect(resendSignatureRequestHandler(confirm, memberContext())).resolves.toMatchObject({
        documentRecordId: DOCUMENT_RECORD_ID,
      });
      expect(resendNotification).toHaveBeenCalledTimes(1);
    });

    it('accepts a free resend confirmed at zero credits', async () => {
      estimateResendCost.mockResolvedValue(rawEstimate({ total_credits: 0 }));

      await resendSignatureRequestHandler({ ...quote, expectedTotalCredits: 0 }, memberContext());

      expect(resendNotification).toHaveBeenCalledTimes(1);
    });

    it.each([0.46, 0.44, 0])('answers COST_CHANGED without resending when the quote moved to %s', async (credits) => {
      estimateResendCost.mockResolvedValue(rawEstimate({ total_credits: credits }));

      await expect(resendSignatureRequestHandler(confirm, memberContext())).rejects.toMatchObject({
        code: 'COST_CHANGED',
        details: { estimate: expect.objectContaining({ totalCredits: credits }) },
      });
      expect(resendNotification).not.toHaveBeenCalled();
    });

    it('compares documents against the fresh quote, since a resend never takes a plan document', async () => {
      estimateResendCost.mockResolvedValue(rawEstimate({ documents: 1 }));

      await resendSignatureRequestHandler(confirm, memberContext());

      expect(resendNotification).toHaveBeenCalledTimes(1);
    });

    it('answers INSUFFICIENT_RESOURCES without resending even at the confirmed cost', async () => {
      estimateResendCost.mockResolvedValue(
        rawEstimate({ has_sufficient_resources: false, blocking_reason: 'InsufficientCredits' }),
      );

      await expect(resendSignatureRequestHandler(confirm, memberContext())).rejects.toMatchObject({
        code: 'INSUFFICIENT_RESOURCES',
        details: { blockingReason: 'InsufficientCredits' },
      });
      expect(resendNotification).not.toHaveBeenCalled();
    });

    it.each([
      ['a network error', new NetworkError('Failed to resend notification: socket hang up')],
      ['a timeout', new NetworkError('Failed to resend notification: timeout of 30000ms exceeded')],
      ['an unexpected error', new TypeError('Cannot read properties of undefined')],
      ['HTTP 408', new ApiError('Request timeout', 408)],
      ['HTTP 409', new ApiError('Conflict', 409)],
      ['HTTP 500', new ApiError('Server error', 500)],
      ['HTTP 502', new ApiError('Bad gateway', 502)],
      ['HTTP 503', new ApiError('Unavailable', 503)],
    ])('answers UNCERTAIN after %s, without retrying or syncing', async (_label, error) => {
      resendNotification.mockRejectedValue(error);

      await expect(resendSignatureRequestHandler(confirm, memberContext())).rejects.toMatchObject({
        code: 'UNCERTAIN',
      });
      expect(resendNotification).toHaveBeenCalledTimes(1);
      expect(sync).not.toHaveBeenCalled();
    });

    it.each([
      [400, 'PROVIDER_REJECTED'],
      [401, 'RECONNECT_REQUIRED'],
      [403, 'FORBIDDEN'],
      [404, 'NOT_FOUND'],
      [422, 'PROVIDER_REJECTED'],
      [429, 'RATE_LIMITED'],
    ])('answers the definitive failure HTTP %i as %s after one attempt', async (status, code) => {
      resendNotification.mockRejectedValue(new ApiError('Refused', status));

      await expect(resendSignatureRequestHandler(confirm, memberContext())).rejects.toMatchObject({ code });
      expect(resendNotification).toHaveBeenCalledTimes(1);
      expect(sync).not.toHaveBeenCalled();
    });

    it.each([
      ['no data', undefined],
      ['no is_sent flag', { document_id: 'doc-1', signer_id: 'signer-1' }],
    ])('answers UNCERTAIN when Assinafy acknowledges the resend with %s', async (_label, response) => {
      resendNotification.mockResolvedValue(response as unknown as Awaited<ReturnType<typeof resendNotification>>);

      await expect(resendSignatureRequestHandler(confirm, memberContext())).rejects.toMatchObject({
        code: 'UNCERTAIN',
      });
      expect(resendNotification).toHaveBeenCalledTimes(1);
      expect(sync).not.toHaveBeenCalled();
    });

    it('answers PROVIDER_REJECTED when Assinafy reports it did not send', async () => {
      resendNotification.mockResolvedValue({ is_sent: false, document_id: 'doc-1', signer_id: 'signer-1' });

      await expect(resendSignatureRequestHandler(confirm, memberContext())).rejects.toMatchObject({
        code: 'PROVIDER_REJECTED',
        message: 'A Assinafy não reenviou o convite.',
        // The app's own text: the front end shows it without the provider prefix.
        details: undefined,
      });
      expect(sync).not.toHaveBeenCalled();
    });

    it('still reports success when the refresh after a successful resend fails', async () => {
      sync.mockRejectedValue(new ApiError('Server error', 500));

      await expect(resendSignatureRequestHandler(confirm, memberContext())).resolves.toEqual(toDocumentSummary(record));
      expect(resendNotification).toHaveBeenCalledTimes(1);
      expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('refresh after resend failed'), {
        code: 'PROVIDER_UNAVAILABLE',
      });
    });
  });
});
