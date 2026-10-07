import { describe, expect, it, vi } from 'vitest';

import { MEMBER_EXECUTION_CONTEXT } from 'src/__tests__/fixtures/member-execution-context';
import { SEND_TIMEOUT_SECONDS } from 'src/constants/limits';
import { SEND_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import sendRoute from 'src/logic-functions/send-signature-request.logic-function';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { sendSignatureRequest } from 'src/services/send-signature-request.service';
import { type DocumentSummary } from 'src/types/document-summary';
import { type HandlerContext } from 'src/types/handler-context';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('src/services/send-signature-request.service', () => ({
  sendSignatureRequest: vi.fn<typeof sendSignatureRequest>(),
}));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({
  buildHandlerContext: vi.fn<typeof buildHandlerContext>(),
}));

const route = sendRoute.config.handler as (event: unknown, context: unknown) => Promise<unknown>;
const ctx = { userWorkspaceId: 'member-1', now: () => new Date('2026-09-25T12:00:00.000Z') } as HandlerContext;
const body = {
  recordId: '0b8f5f7e-6d1c-4a55-9c43-1f5a3b2c9d10',
  source: { type: 'PDF', attachmentId: '44444444-4444-4444-8444-444444444444' },
  name: 'Contract',
  signers: [{ name: 'Ada', email: 'ada@example.invalid', verificationMethod: 'Email' }],
  assinafyDocumentId: 'doc-1',
  requestId: '77777777-7777-4777-8777-777777777777',
  accountId: 'acc-1',
  expectedTotalCredits: 0.45,
  expectedDocuments: 1,
};

describe('send-signature-request logic function', () => {
  it('is an authenticated POST route with the send timeout', () => {
    expect(sendRoute.success).toBe(true);
    expect(sendRoute.config).toMatchObject({
      universalIdentifier: SEND_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: SEND_TIMEOUT_SECONDS,
      httpRouteTriggerSettings: { path: '/assinafy/send', httpMethod: 'POST', isAuthRequired: true },
    });
  });

  it('sends the confirmed request with its idempotency key and expected cost', async () => {
    const summary = { documentRecordId: 'doc-record-1', status: 'PENDING_SIGNATURE' } as DocumentSummary;
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    vi.mocked(sendSignatureRequest).mockResolvedValue(summary);

    await expect(route({ body }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({ ok: true, ...summary });
    expect(sendSignatureRequest).toHaveBeenCalledExactlyOnceWith(
      ctx,
      expect.objectContaining({
        requestId: body.requestId,
        accountId: 'acc-1',
        expectedTotalCredits: 0.45,
        expectedDocuments: 1,
        assinafyDocumentId: 'doc-1',
        deadlineMs: ctx.now().getTime() + (SEND_TIMEOUT_SECONDS - 10) * 1000,
      }),
    );
  });

  it.each([
    ['30 minutes ahead', '2026-09-25T12:30:00Z'],
    ['already past', '2026-09-25T11:30:00Z'],
  ])('reaches the request id lookup with a deadline %s, so a retry is never refused first', async (_label, expiresAt) => {
    const summary = { documentRecordId: 'doc-record-1', status: 'PENDING_SIGNATURE' } as DocumentSummary;
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    vi.mocked(sendSignatureRequest).mockResolvedValue(summary);

    await expect(route({ body: { ...body, expiresAt } }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({ ok: true, ...summary });
    expect(sendSignatureRequest).toHaveBeenCalledExactlyOnceWith(
      ctx,
      expect.objectContaining({ requestId: body.requestId, expiresAt: new Date(expiresAt).toISOString() }),
    );
  });

  it('answers an uncertain send in the envelope without retrying it', async () => {
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    vi.mocked(sendSignatureRequest).mockRejectedValue(new AppFailure('UNCERTAIN', 'Check Assinafy'));

    await expect(route({ body }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({
      ok: false,
      error: { code: 'UNCERTAIN', message: 'Check Assinafy', details: undefined },
    });
    expect(sendSignatureRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects a request without its idempotency key and a call without a member', async () => {
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    await expect(route({ body: { ...body, requestId: undefined } }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      error: { code: 'INVALID_INPUT' },
    });

    vi.mocked(buildHandlerContext).mockReturnValue({ ...ctx, userWorkspaceId: null });
    await expect(route({ body }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(sendSignatureRequest).not.toHaveBeenCalled();
  });
});
