import {
  AppConnectionAuthFailedError,
  getConnection,
  listConnections,
  type LogicFunctionExecutionContext,
} from 'twenty-sdk/logic-function';

import { revokeAssinafyGrant } from 'src/assinafy-client/revoke-assinafy-grant';
import { ASSINAFY_CONNECTION_PROVIDER_NAME } from 'src/constants/assinafy';

// getConnection refuses a connection the app flagged (e.g. for a missing scope) although its grant may still be
// valid; the connection list still carries that connection's token.
const readAccessToken = async (connectedAccountId: string): Promise<string> => {
  try {
    return (await getConnection(connectedAccountId)).accessToken;
  } catch (error) {
    if (!(error instanceof AppConnectionAuthFailedError)) throw error;
    const listed = await listConnections({ providerName: ASSINAFY_CONNECTION_PROVIDER_NAME });
    const connection = listed.find(({ id }) => id === connectedAccountId);
    if (!connection) throw error;
    return connection.accessToken;
  }
};

// Revokes the grant in Assinafy when its Twenty connection is removed. Runs inline in the disconnect request and
// never throws. Twenty runs the real hook without a person; a run a member starts (any role with the Workflows
// permission can execute any function, with any connection id) is ignored.
export const onAssinafyDisconnectHandler = async (
  { connectedAccountId }: { connectedAccountId: string },
  context?: Pick<LogicFunctionExecutionContext, 'userWorkspaceId'>,
): Promise<void> => {
  if (context?.userWorkspaceId) {
    console.warn('[assinafy] on-assinafy-disconnect: member-triggered run ignored', { code: 'FORBIDDEN' });
    return;
  }

  await revokeAssinafyGrant('on-assinafy-disconnect', () => readAccessToken(connectedAccountId));
};
