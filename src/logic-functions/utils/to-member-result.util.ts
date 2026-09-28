import { type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import { buildHandlerContext } from 'src/logic-functions/utils/build-handler-context.util';
import { requirePerson } from 'src/logic-functions/utils/require-person.util';
import { type AppResult } from 'src/types/app-result';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { toAppResult } from 'src/utils/to-app-result.util';

// Routes and AI tools: build the context, refuse calls without a member, answer with the { ok } envelope.
export const toMemberResult = <T extends object>(
  operation: string,
  context: LogicFunctionExecutionContext,
  run: (ctx: MemberHandlerContext) => Promise<T>,
): Promise<AppResult<T>> =>
  toAppResult(operation, async () => {
    const ctx = buildHandlerContext(context);
    requirePerson(ctx);
    return run(ctx);
  });
