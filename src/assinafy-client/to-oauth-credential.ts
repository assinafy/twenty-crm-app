import { type AppConnection } from 'twenty-sdk/logic-function';

import { type AssinafyCredential } from 'src/types/assinafy-credential';
import { AppFailure } from 'src/utils/app-failure.util';

export const toOAuthCredential = (connection: AppConnection): AssinafyCredential => {
  if (connection.providerType !== 'oauth') {
    throw new AppFailure('PROVIDER_UNAVAILABLE', 'Unexpected connection provider type', { provider: 'twenty' });
  }
  return {
    kind: connection.visibility === 'user' ? 'personal' : 'shared',
    connectionId: connection.id,
    accessToken: connection.accessToken,
    scopes: connection.scopes,
  };
};
