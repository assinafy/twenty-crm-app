import { defineConnectionProvider } from 'twenty-sdk/define';

import {
  ASSINAFY_AUTHORIZATION_ENDPOINT,
  ASSINAFY_CLIENT_ID_VARIABLE,
  ASSINAFY_CLIENT_SECRET_VARIABLE,
  ASSINAFY_CONNECTION_PROVIDER_NAME,
  ASSINAFY_OAUTH_SCOPES,
  ASSINAFY_TOKEN_ENDPOINT,
} from 'src/constants/assinafy';
import {
  CONNECTION_PROVIDER_UNIVERSAL_IDENTIFIER,
  ON_DISCONNECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// No revokeEndpoint: Twenty's revoke request omits the client credentials Assinafy requires,
// so the on-disconnect logic function revokes the token instead.
export default defineConnectionProvider({
  universalIdentifier: CONNECTION_PROVIDER_UNIVERSAL_IDENTIFIER,
  name: ASSINAFY_CONNECTION_PROVIDER_NAME,
  displayName: 'Assinafy',
  logo: 'public/logo.svg',
  type: 'oauth',
  oauth: {
    authorizationEndpoint: ASSINAFY_AUTHORIZATION_ENDPOINT,
    tokenEndpoint: ASSINAFY_TOKEN_ENDPOINT,
    scopes: ASSINAFY_OAUTH_SCOPES,
    clientIdVariable: ASSINAFY_CLIENT_ID_VARIABLE,
    clientSecretVariable: ASSINAFY_CLIENT_SECRET_VARIABLE,
    tokenRequestContentType: 'form-urlencoded',
    usePkce: true,
  },
  onDisconnectLogicFunction: {
    universalIdentifier: ON_DISCONNECT_UNIVERSAL_IDENTIFIER,
  },
});
