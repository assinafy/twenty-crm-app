import { type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import { listAssinafyConnections } from 'src/assinafy-client/list-assinafy-connections';
import { revokeAssinafyGrant } from 'src/assinafy-client/revoke-assinafy-grant';

// Uninstalling drops connections by database cascade without running the disconnect hook, so every grant (personal
// and flagged ones included: this is the only unfiltered listing) is revoked here with the token the listing already
// resolved, so each connection is read (and refreshed) once. Twenty runs the real hook without a person; a run a
// member starts (any role with the Workflows permission can execute any function) is ignored. Best effort; never
// throws.
export const uninstallHandler = async (
  _payload?: unknown,
  context?: Pick<LogicFunctionExecutionContext, 'userWorkspaceId'>,
): Promise<void> => {
  if (context?.userWorkspaceId) {
    console.warn('[assinafy] uninstall: member-triggered run ignored', { code: 'FORBIDDEN' });
    return;
  }

  // listAssinafyConnections already logs its failure.
  const connections = await listAssinafyConnections({}).catch(() => []);

  await Promise.all(
    connections.map(({ accessToken }) => revokeAssinafyGrant('uninstall', () => Promise.resolve(accessToken))),
  );
};
