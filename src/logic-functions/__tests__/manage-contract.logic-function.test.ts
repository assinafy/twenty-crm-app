import { describe, expect, it, vi } from 'vitest';

import { buildContext } from 'src/__tests__/fixtures/build-context';
import { MEMBER_EXECUTION_CONTEXT } from 'src/__tests__/fixtures/member-execution-context';
import { MANAGE_CONTRACT_ROUTE_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { DOCUMENT_RECORD_ID } from 'src/logic-functions/handlers/__tests__/document-handler-fixtures';
import { manageContractHandler } from 'src/logic-functions/handlers/manage-contract.handler';
import manageContract from 'src/logic-functions/manage-contract.logic-function';
import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { AppFailure } from 'src/utils/app-failure.util';

vi.mock('src/logic-functions/handlers/manage-contract.handler', () => ({ manageContractHandler: vi.fn<typeof manageContractHandler>() }));
vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({ buildHandlerContext: vi.fn<typeof buildHandlerContext>() }));

const handler = vi.mocked(manageContractHandler);
const build = vi.mocked(buildHandlerContext);
const route = manageContract.config.handler as (event: unknown, context: unknown) => Promise<unknown>;

describe('manage-contract logic function', () => {
  it('is an authenticated POST route', () => {
    expect(manageContract.success).toBe(true);
    expect(manageContract.config).toMatchObject({
      universalIdentifier: MANAGE_CONTRACT_ROUTE_UNIVERSAL_IDENTIFIER,
      timeoutSeconds: 120,
      httpRouteTriggerSettings: { path: '/assinafy/documents/contract', httpMethod: 'POST', isAuthRequired: true },
    });
  });

  it('runs the handler with the parsed body and answers the summary in an envelope', async () => {
    const ctx = buildContext();
    const summary = { contract: null };
    build.mockReturnValue(ctx);
    handler.mockResolvedValue(summary);

    await expect(route({ body: { documentRecordId: DOCUMENT_RECORD_ID, action: 'get' } }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({
      ok: true,
      ...summary,
    });
    expect(build).toHaveBeenCalledWith(MEMBER_EXECUTION_CONTEXT);
    expect(handler).toHaveBeenCalledWith({ documentRecordId: DOCUMENT_RECORD_ID, action: 'get' }, ctx);
  });

  it('answers FORBIDDEN without a workspace member, without running the handler', async () => {
    build.mockReturnValue(buildContext({ userWorkspaceId: null }));

    await expect(route({ body: { documentRecordId: DOCUMENT_RECORD_ID, action: 'get' } }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers INVALID_INPUT without running the handler', async () => {
    build.mockReturnValue(buildContext());

    await expect(route({ body: { documentRecordId: 'nope', action: 'get' } }, MEMBER_EXECUTION_CONTEXT)).resolves.toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('answers handler failures in the envelope', async () => {
    build.mockReturnValue(buildContext());
    handler.mockRejectedValue(new AppFailure('NOT_FOUND', 'Documento não encontrado.'));

    await expect(route({ body: { documentRecordId: DOCUMENT_RECORD_ID, action: 'get' } }, MEMBER_EXECUTION_CONTEXT)).resolves.toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Documento não encontrado.', details: undefined },
    });
  });
});
