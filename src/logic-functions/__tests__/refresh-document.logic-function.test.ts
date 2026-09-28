import { describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { MEMBER_EXECUTION_CONTEXT } from 'src/__tests__/fixtures/member-execution-context';
import { REFRESH_DOCUMENT_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { DOCUMENT_RECORD_ID } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { refreshDocumentHandler } from 'src/logic-functions/handlers/refresh-document.handler';
import refreshDocument from 'src/logic-functions/refresh-document.logic-function';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { AppFailure } from 'src/utils/app-failure.util';
import { toDocumentSummary } from 'src/utils/to-document-summary.util';

vi.mock('src/logic-functions/handlers/refresh-document.handler', () => ({ refreshDocumentHandler: vi.fn<typeof refreshDocumentHandler>() }));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({ buildHandlerContext: vi.fn<typeof buildHandlerContext>() }));

const handler = vi.mocked(refreshDocumentHandler);
const build = vi.mocked(buildHandlerContext);
const route = refreshDocument.config.handler as (event: unknown, context: unknown) => Promise<unknown>;

describe('refresh-document logic function', () => {
  it('is an authenticated POST route', () => {
    expect(refreshDocument.success).toBe(true);
    expect(refreshDocument.config).toMatchObject({
      universalIdentifier: REFRESH_DOCUMENT_ROUTE_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: 60,
      httpRouteTriggerSettings: { path: '/assinafy/documents/refresh', httpMethod: 'POST', isAuthRequired: true },
    });
  });

  it('runs the handler with the parsed body and answers the summary in an envelope', async () => {
    const ctx = buildContext();
    const summary = toDocumentSummary(buildDocumentRecord());
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

    await expect(route({ body: { documentRecordId: 'nope' } }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers handler failures in the envelope', async () => {
    build.mockReturnValue(buildContext());
    handler.mockRejectedValue(new AppFailure('NOT_FOUND', 'Documento não encontrado.'));

    await expect(route({ body: { documentRecordId: DOCUMENT_RECORD_ID } }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Documento não encontrado.', details: undefined },
    });
  });
});
