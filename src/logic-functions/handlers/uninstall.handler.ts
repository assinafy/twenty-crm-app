import { type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import { createAssinafyClient } from 'src/assinafy-client/create-assinafy-client';
import { listAssinafyConnections } from 'src/assinafy-client/list-assinafy-connections';
import { readApiKeyCredential } from 'src/assinafy-client/read-api-key-credential';
import { resolveBackgroundAccounts } from 'src/assinafy-client/resolve-background-accounts';
import { revokeAssinafyGrant } from 'src/assinafy-client/revoke-assinafy-grant';
import { toOAuthCredential } from 'src/assinafy-client/to-oauth-credential';
import { reconcileWebhookEndpoints } from 'src/services/reconcile-webhook-endpoints.service';
import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';
import { toAppError } from 'src/utils/to-app-error.util';

// Uninstalling drops connections by database cascade without running the disconnect hook, so every access token
// (personal and flagged ones included: this is the only unfiltered listing) is revoked here with the token the listing already
// resolved, so each connection is read (and refreshed) once. Twenty runs the real hook without a person; a run a
// member starts (any role with the Workflows permission can execute any function) is ignored. The app's webhook
// endpoints are removed first, while the tokens still work, so they free their slots in Assinafy. Best effort; never
// throws.
export const uninstallHandler = async (
  _payload?: unknown,
  context?: Pick<LogicFunctionExecutionContext, 'userWorkspaceId'>,
  createClient: CreateAssinafyClient = createAssinafyClient,
): Promise<void> => {
  if (context?.userWorkspaceId) {
    console.warn('[assinafy] uninstall: member-triggered run ignored', { code: 'FORBIDDEN' });
    return;
  }

  // listAssinafyConnections already logs its failure.
  const connections = await listAssinafyConnections({}).catch(() => []);

  const apiKey = readApiKeyCredential();
  const credentials = [...(apiKey ? [apiKey] : []), ...connections.map(toOAuthCredential)];
  try {
    await reconcileWebhookEndpoints(await resolveBackgroundAccounts('uninstall', credentials, createClient), null);
  } catch (error) {
    console.warn('[assinafy] uninstall: webhook endpoints not removed', { code: toAppError(error, 'mutation').code });
  }

  await Promise.all(
    connections.map(({ accessToken }) => revokeAssinafyGrant('uninstall', () => Promise.resolve(accessToken))),
  );
};
