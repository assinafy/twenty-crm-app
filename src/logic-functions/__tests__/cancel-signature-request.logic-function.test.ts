import { describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import cancelSignatureRequest from 'src/logic-functions/cancel-signature-request.logic-function';
import { MEMBER_EXECUTION_CONTEXT } from 'src/__tests__/fixtures/member-execution-context';
import { CANCEL_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { cancelSignatureRequestHandler } from 'src/logic-functions/handlers/cancel-signature-request.handler';
import { DOCUMENT_RECORD_ID } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { AppFailure } from 'src/utils/app-failure.util';
import { toDocumentSummary } from 'src/utils/to-document-summary.util';

vi.mock('src/logic-functions/handlers/cancel-signature-request.handler', () => ({
  cancelSignatureRequestHandler: vi.fn<typeof cancelSignatureRequestHandler>(),
}));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({ buildHandlerContext: vi.fn<typeof buildHandlerContext>() }));

const handler = vi.mocked(cancelSignatureRequestHandler);
const build = vi.mocked(buildHandlerContext);
const route = cancelSignatureRequest.config.handler as (event: unknown, context: unknown) => Promise<unknown>;

describe('cancel-signature-request logic function', () => {
  it('is an authenticated POST route', () => {
    expect(cancelSignatureRequest.success).toBe(true);
    expect(cancelSignatureRequest.config).toMatchObject({
      universalIdentifier: CANCEL_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: 60,
      httpRouteTriggerSettings: { path: '/assinafy/documents/cancel', httpMethod: 'POST', isAuthRequired: true },
    });
  });

  it('runs the handler with the parsed body and answers the summary in an envelope', async () => {
    const ctx = buildContext();
    const summary = toDocumentSummary(buildDocumentRecord({ status: 'CANCELLED' }));
    build.mockReturnValue(ctx);
    handler.mockResolvedValue(summary);

    await expect(route({ body: { documentRecordId: DOCUMENT_RECORD_ID } }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({
      ok: true,
      ...summary,
    });
    expect(build).toHaveBeenCalledWith(MEMBER_EXECUTION_CONTEXT);
    expect(handler).toHaveBeenCalledWith({ documentRecordId: DOCUMENT_RECORD_ID }, ctx);
  });

  it('answers FORBIDDEN without a workspace member, without running the handler', async () => {
    build.mockReturnValue(buildContext({ userWorkspaceId: null }));

    await expect(route({ body: { documentRecordId: DOCUMENT_RECORD_ID } }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers INVALID_INPUT without running the handler', async () => {
    build.mockReturnValue(buildContext());

    await expect(route({ body: null }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers handler failures in the envelope', async () => {
    build.mockReturnValue(buildContext());
    handler.mockRejectedValue(new AppFailure('INVALID_STATE', 'Not cancellable'));

    await expect(route({ body: { documentRecordId: DOCUMENT_RECORD_ID } }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_STATE' },
    });
  });
});
