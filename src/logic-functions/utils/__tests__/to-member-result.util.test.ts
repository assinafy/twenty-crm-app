import { type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';
import { describe, expect, it, vi } from 'vitest';

import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { toMemberResult } from 'src/logic-functions/utils/to-member-result.util';
import { type HandlerContext } from 'src/types/handler-context';

vi.mock('src/logic-functions/utils/build-handler-context.util', () => ({ buildHandlerContext: vi.fn<typeof buildHandlerContext>() }));

const build = vi.mocked(buildHandlerContext);
const executionContext = { userWorkspaceId: 'member-1' } as LogicFunctionExecutionContext;

describe('toMemberResult', () => {
  it('refuses a call without a workspace member and does not run', async () => {
    build.mockReturnValue({ userWorkspaceId: null } as HandlerContext);
    const run = vi.fn<(ctx: HandlerContext) => Promise<{ value: number }>>(async () => ({ value: 1 }));

    await expect(toMemberResult('operation', executionContext, run)).resolves.toMatchObject({
      ok: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(run).not.toHaveBeenCalled();
  });

  it('runs with the built context and answers the result in an envelope', async () => {
    const ctx = { userWorkspaceId: 'member-1' } as HandlerContext;
    build.mockReturnValue(ctx);
    const run = vi.fn<(ctx: HandlerContext) => Promise<{ value: number }>>(async () => ({ value: 1 }));

    await expect(toMemberResult('operation', executionContext, run)).resolves.toEqual({ value: 1, ok: true });
    expect(build).toHaveBeenCalledWith(executionContext);
    expect(run).toHaveBeenCalledWith(ctx);
  });
});
