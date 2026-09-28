import { type AppConnection } from 'twenty-sdk/logic-function';

import { detectExpiredConnections } from 'src/assinafy-client/detect-expired-connections';
import { isUsableConnection } from 'src/assinafy-client/is-usable-connection';
import { listAssinafyConnections } from 'src/assinafy-client/list-assinafy-connections';

// Runs detection on every listing (not only when none is usable): ids must be remembered while still listed.
export const listSharedConnections = async (): Promise<AppConnection[]> => {
  const listed = await listAssinafyConnections({ visibility: 'workspace' });
  await detectExpiredConnections(listed);
  return listed.filter((connection) => isUsableConnection(connection, null));
};
