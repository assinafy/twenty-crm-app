export const ASSINAFY_CONNECTION_PROVIDER_NAME = 'assinafy';

export const ASSINAFY_API_BASE_URL = 'https://api.assinafy.com.br/v1';

export const ASSINAFY_AUTHORIZATION_ENDPOINT =
  'https://auth.assinafy.com.br/oauth/authorize';

export const ASSINAFY_TOKEN_ENDPOINT = 'https://api.assinafy.com.br/v1/oauth/token';

// Creating a document from a template needs templates:write in production; offline_access issues the refresh token.
export const ASSINAFY_OAUTH_SCOPES = [
  'documents:read',
  'documents:write',
  'templates:read',
  'templates:write',
  'account:read',
  'offline_access',
];

export const ASSINAFY_CLIENT_ID_VARIABLE = 'ASSINAFY_CLIENT_ID';
export const ASSINAFY_CLIENT_SECRET_VARIABLE = 'ASSINAFY_CLIENT_SECRET';
export const ASSINAFY_API_KEY_VARIABLE = 'ASSINAFY_API_KEY';
export const ASSINAFY_ACCOUNT_ID_VARIABLE = 'ASSINAFY_ACCOUNT_ID';
