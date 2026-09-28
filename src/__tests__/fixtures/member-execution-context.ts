import { type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

// A route or tool call made by a signed-in workspace member.
export const MEMBER_EXECUTION_CONTEXT: LogicFunctionExecutionContext = {
  retryCount: 0,
  maxRetries: 0,
  workspaceId: 'workspace-1',
  userWorkspaceId: 'member-1',
  workspaceMemberId: 'workspace-member-1',
};
