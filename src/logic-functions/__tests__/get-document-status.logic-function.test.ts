import { describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { MEMBER_EXECUTION_CONTEXT } from 'src/__tests__/fixtures/member-execution-context';
import { GET_DOCUMENT_STATUS_TOOL_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import getDocumentStatus from 'src/logic-functions/get-document-status.logic-function';
import { DOCUMENT_RECORD_ID } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { getDocumentStatusHandler } from 'src/logic-functions/handlers/get-document-status.handler';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { AppFailure } from 'src/utils/app-failure.util';
import { toDocumentSummary } from 'src/utils/to-document-summary.util';

vi.mock('src/logic-functions/handlers/get-document-status.handler', () => ({ getDocumentStatusHandler: vi.fn<typeof getDocumentStatusHandler>() }));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({ buildHandlerContext: vi.fn<typeof buildHandlerContext>() }));

const handler = vi.mocked(getDocumentStatusHandler);
const build = vi.mocked(buildHandlerContext);
const tool = getDocumentStatus.config.handler as (input: unknown, context: unknown) => Promise<unknown>;

describe('get-document-status logic function', () => {
  it('is an AI tool taking the document record id', () => {
    expect(getDocumentStatus.success).toBe(true);
    expect(getDocumentStatus.config).toMatchObject({
      universalIdentifier: GET_DOCUMENT_STATUS_TOOL_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: 60,
      toolTriggerSettings: {
        inputSchema: { type: 'object', required: ['documentRecordId'], additionalProperties: false },
      },
    });
    expect(getDocumentStatus.config.description).toContain('sem gerar cobrança');
    expect(getDocumentStatus.config.description).not.toContain('Somente leitura');
    expect(getDocumentStatus.config).not.toHaveProperty('httpRouteTriggerSettings');
  });

  it('runs the handler with the tool input and answers in an envelope', async () => {
    const ctx = buildContext();
    const result = { document: toDocumentSummary(buildDocumentRecord()), text: 'Aguardando assinaturas.' };
    build.mockReturnValue(ctx);
    handler.mockResolvedValue(result);

    await expect(tool({ documentRecordId: DOCUMENT_RECORD_ID }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({
      ok: true,
      ...result,
    });
    expect(build).toHaveBeenCalledWith(MEMBER_EXECUTION_CONTEXT);
    expect(handler).toHaveBeenCalledWith({ documentRecordId: DOCUMENT_RECORD_ID }, ctx);
  });

  it('answers FORBIDDEN without a workspace member, without running the handler', async () => {
    build.mockReturnValue(buildContext({ userWorkspaceId: null }));

    await expect(tool({ documentRecordId: DOCUMENT_RECORD_ID }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers INVALID_INPUT for an unknown key without running the handler', async () => {
    build.mockReturnValue(buildContext());

    await expect(tool({ documentRecordId: DOCUMENT_RECORD_ID, extra: 1 }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers handler failures in the envelope', async () => {
    build.mockReturnValue(buildContext());
    handler.mockRejectedValue(new AppFailure('FORBIDDEN', 'Requires a member'));

    await expect(tool({ documentRecordId: DOCUMENT_RECORD_ID }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
  });
});
