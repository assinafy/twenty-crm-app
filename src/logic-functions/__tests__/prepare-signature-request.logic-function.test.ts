import { describe, expect, it, vi } from 'vitest';

import { MEMBER_EXECUTION_CONTEXT } from 'src/__tests__/fixtures/member-execution-context';
import { SEND_TIMEOUT_SECONDS } from 'src/constants/limits';
import { PREPARE_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import prepareRoute from 'src/logic-functions/prepare-signature-request.logic-function';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { prepareSignatureRequest } from 'src/services/prepare-signature-request.service';
import { type HandlerContext } from 'src/types/handler-context';
import { type PreparedSignatureRequest } from 'src/types/prepared-signature-request';

vi.mock('src/services/prepare-signature-request.service', () => ({
  prepareSignatureRequest: vi.fn<typeof prepareSignatureRequest>(),
}));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({
  buildHandlerContext: vi.fn<typeof buildHandlerContext>(),
}));

const route = prepareRoute.config.handler as (event: unknown, context: unknown) => Promise<unknown>;
const ctx = { userWorkspaceId: 'member-1', now: () => new Date('2026-09-25T12:00:00.000Z') } as HandlerContext;
const body = {
  recordId: '0b8f5f7e-6d1c-4a55-9c43-1f5a3b2c9d10',
  source: { type: 'PDF', attachmentId: '44444444-4444-4444-8444-444444444444' },
  name: 'Contract',
  signers: [{ name: 'Ada', email: 'ada@example.invalid', verificationMethod: 'Email' }],
  expiresAt: '2026-09-26T12:00:00.000Z',
};

describe('prepare-signature-request logic function', () => {
  it('is an authenticated POST route with room for the download, upload and estimate', () => {
    expect(prepareRoute.success).toBe(true);
    expect(prepareRoute.config).toMatchObject({
      universalIdentifier: PREPARE_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: SEND_TIMEOUT_SECONDS,
      httpRouteTriggerSettings: { path: '/assinafy/prepare', httpMethod: 'POST', isAuthRequired: true },
    });
  });

  it('prepares the parsed request and answers the estimate', async () => {
    const prepared = { accountId: 'acc-1', assinafyDocumentId: 'doc-1' } as PreparedSignatureRequest;
    vi.mocked(buildHandlerContext).mockReturnValue(ctx);
    vi.mocked(prepareSignatureRequest).mockResolvedValue(prepared);

    await expect(route({ body }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({ ok: true, ...prepared });
    expect(prepareSignatureRequest).toHaveBeenCalledExactlyOnceWith(
      ctx,
      expect.objectContaining({ recordId: body.recordId, name: 'Contract', expiresAt: body.expiresAt }),
    );
  });

  it('validates the deadline against the injected clock', async () => {
    vi.mocked(buildHandlerContext).mockReturnValue({ ...ctx, now: () => new Date('2026-09-26T12:00:00.000Z') });

    await expect(route({ body }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({ error: { code: 'INVALID_INPUT' } });
    expect(prepareSignatureRequest).not.toHaveBeenCalled();
  });

  it('answers FORBIDDEN without a workspace member', async () => {
    vi.mocked(buildHandlerContext).mockReturnValue({ ...ctx, userWorkspaceId: null });

    await expect(route({ body }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({ error: { code: 'FORBIDDEN' } });
    expect(prepareSignatureRequest).not.toHaveBeenCalled();
  });
});
