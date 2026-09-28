import { type AppConnection } from 'twenty-sdk/logic-function';

import { ASSINAFY_CONNECTION_PROVIDER_NAME } from 'src/constants/assinafy';

// A personal connection is usable only by the member who owns it; `null` (no person) never matches one.
export const isUsableConnection = (connection: AppConnection, userWorkspaceId: string | null): boolean =>
  connection.providerName === ASSINAFY_CONNECTION_PROVIDER_NAME &&
  connection.authFailedAt === null &&
  (connection.visibility === 'workspace' || connection.userWorkspaceId === userWorkspaceId);
