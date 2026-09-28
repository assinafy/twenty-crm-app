import { type AppConnection } from 'twenty-sdk/logic-function';

import { type AssinafyCredential } from 'src/types/assinafy-credential';

export const toOAuthCredential = (connection: AppConnection): AssinafyCredential => ({
  kind: connection.visibility === 'user' ? 'personal' : 'shared',
  connectionId: connection.id,
  accessToken: connection.accessToken,
  scopes: connection.scopes,
});
