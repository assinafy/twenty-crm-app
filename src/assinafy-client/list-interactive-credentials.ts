import { isUsableConnection } from 'src/assinafy-client/is-usable-connection';
import { listAssinafyConnections } from 'src/assinafy-client/list-assinafy-connections';
import { listSharedConnections } from 'src/assinafy-client/list-shared-connections';
import { readApiKeyCredential } from 'src/assinafy-client/read-api-key-credential';
import { toOAuthCredential } from 'src/assinafy-client/to-oauth-credential';
import { type AssinafyCredential } from 'src/types/assinafy-credential';

// Order: the member's personal connection, their own shared ones, the other shared ones, then the API key.
// Sequential on purpose: parallel listings race Twenty's token refresh.
export const listInteractiveCredentials = async (userWorkspaceId: string): Promise<AssinafyCredential[]> => {
  const own = (await listAssinafyConnections({ userWorkspaceId })).filter((connection) =>
    isUsableConnection(connection, userWorkspaceId),
  );
  const shared = await listSharedConnections();

  const ordered = [
    ...own.filter((connection) => connection.visibility === 'user'),
    ...own.filter((connection) => connection.visibility === 'workspace'),
    ...shared,
  ];
  const connections = ordered.filter(
    (connection, index) => ordered.findIndex((other) => other.id === connection.id) === index,
  );
  const apiKey = readApiKeyCredential();

  return [...connections.map(toOAuthCredential), ...(apiKey ? [apiKey] : [])];
};
