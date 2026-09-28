import { describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { buildCostEstimate } from 'src/__tests__/fixtures/build-cost-estimate';
import { MEMBER_EXECUTION_CONTEXT } from 'src/__tests__/fixtures/member-execution-context';
import { RESEND_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { DOCUMENT_RECORD_ID } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { resendSignatureRequestHandler } from 'src/logic-functions/handlers/resend-signature-request.handler';
import resendSignatureRequest from 'src/logic-functions/resend-signature-request.logic-function';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('src/logic-functions/handlers/resend-signature-request.handler', () => ({
  resendSignatureRequestHandler: vi.fn<typeof resendSignatureRequestHandler>(),
}));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({ buildHandlerContext: vi.fn<typeof buildHandlerContext>() }));

const handler = vi.mocked(resendSignatureRequestHandler);
const build = vi.mocked(buildHandlerContext);
const route = resendSignatureRequest.config.handler as (event: unknown, context: unknown) => Promise<unknown>;
const body = { documentRecordId: DOCUMENT_RECORD_ID, signerId: 'signer-1', expectedTotalCredits: 0.45 };

describe('resend-signature-request logic function', () => {
  it('is an authenticated POST route', () => {
    expect(resendSignatureRequest.success).toBe(true);
    expect(resendSignatureRequest.config).toMatchObject({
      universalIdentifier: RESEND_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: 60,
      httpRouteTriggerSettings: { path: '/assinafy/documents/resend', httpMethod: 'POST', isAuthRequired: true },
    });
  });

  it('runs the handler with the parsed body and answers in an envelope', async () => {
    const ctx = buildContext();
    const estimate = buildCostEstimate();
    build.mockReturnValue(ctx);
    handler.mockResolvedValue({ estimate });

    await expect(route({ body: { ...body, expectedTotalCredits: null } }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({
      ok: true,
      estimate,
    });
    expect(build).toHaveBeenCalledWith(MEMBER_EXECUTION_CONTEXT);
    expect(handler).toHaveBeenCalledWith({ ...body, expectedTotalCredits: null }, ctx);
  });

  it('answers FORBIDDEN without a workspace member, without running the handler', async () => {
    build.mockReturnValue(buildContext({ userWorkspaceId: null }));

    await expect(route({ body }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers INVALID_INPUT without running the handler', async () => {
    build.mockReturnValue(buildContext());

    await expect(route({ body: { ...body, expectedTotalCredits: -1 } }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers handler failures in the envelope', async () => {
    build.mockReturnValue(buildContext());
    handler.mockRejectedValue(new AppFailure('UNCERTAIN', 'Check Assinafy'));

    await expect(route({ body }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'UNCERTAIN' },
    });
  });
});
