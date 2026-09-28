import { listSharedConnections } from 'src/assinafy-client/list-shared-connections';
import { readApiKeyCredential } from 'src/assinafy-client/read-api-key-credential';
import { toOAuthCredential } from 'src/assinafy-client/to-oauth-credential';
import { type AssinafyCredential } from 'src/types/assinafy-credential';

// No person is present (cron, workflow, health check), so personal connections are never candidates.
export const listBackgroundCredentials = async (): Promise<AssinafyCredential[]> => {
  const shared = await listSharedConnections();
  const apiKey = readApiKeyCredential();

  return [...(apiKey ? [apiKey] : []), ...shared.map(toOAuthCredential)];
};
