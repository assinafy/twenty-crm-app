export const ASSINAFY_CONNECTION_PROVIDER_NAME = 'assinafy';

export const ASSINAFY_API_BASE_URL = 'https://api.assinafy.com.br/v1';

export const ASSINAFY_AUTHORIZATION_ENDPOINT =
  'https://auth.assinafy.com.br/oauth/authorize';

export const ASSINAFY_TOKEN_ENDPOINT = 'https://api.assinafy.com.br/v1/oauth/token';

// Creating a document from a template needs templates:write in production; webhooks:write lets a shared connection
// register the app's webhook endpoint; offline_access issues the refresh token.
export const ASSINAFY_OAUTH_SCOPES = [
  'documents:read',
  'documents:write',
  'templates:read',
  'templates:write',
  'account:read',
  'webhooks:write',
  'offline_access',
];

export const ASSINAFY_CLIENT_ID_VARIABLE = 'ASSINAFY_CLIENT_ID';
export const ASSINAFY_CLIENT_SECRET_VARIABLE = 'ASSINAFY_CLIENT_SECRET';
export const ASSINAFY_API_KEY_VARIABLE = 'ASSINAFY_API_KEY';
export const ASSINAFY_ACCOUNT_ID_VARIABLE = 'ASSINAFY_ACCOUNT_ID';
export const ASSINAFY_WEBHOOK_EMAIL_VARIABLE = 'ASSINAFY_WEBHOOK_EMAIL';

// The route Assinafy delivers webhook events to, under the workspace's functions URL.
export const WEBHOOK_ROUTE_PATH = '/assinafy/webhook';
export const WEBHOOK_ENDPOINT_NAME = 'Twenty';
// Events that change a document's status or its signers' progress; every one triggers a re-read of the document.
export const WEBHOOK_EVENTS = [
  'signer_signed_document',
  'signer_rejected_document',
  'user_rejected_document',
  'document_ready',
  'document_processing_failed',
];
// Standard Webhooks headers Twenty forwards to the webhook route.
export const WEBHOOK_SIGNATURE_HEADERS = ['webhook-id', 'webhook-timestamp', 'webhook-signature'];
