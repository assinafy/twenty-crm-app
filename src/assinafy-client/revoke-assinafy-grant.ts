import { AssinafyClient } from '@assinafy/sdk';

import {
  ASSINAFY_API_BASE_URL,
  ASSINAFY_CLIENT_ID_VARIABLE,
  ASSINAFY_CLIENT_SECRET_VARIABLE,
} from 'src/constants/assinafy';
import { errorName } from 'src/utils/error-name.util';

// Revokes the available access token with the app's OAuth client. Twenty exposes no refresh token to the app;
// access-token revocation does not end the refresh authorization. The token is read only when client credentials
// are configured. Best effort: never throws and never logs the token.
export const revokeAssinafyGrant = async (operation: string, readAccessToken: () => Promise<string>): Promise<void> => {
  const clientId = process.env[ASSINAFY_CLIENT_ID_VARIABLE]?.trim();
  const clientSecret = process.env[ASSINAFY_CLIENT_SECRET_VARIABLE]?.trim();
  if (!clientId || !clientSecret) return;

  try {
    const token = await readAccessToken();

    // The SDK sends OAuth endpoint calls on its credential-free transport, so this client carries no credential.
    await new AssinafyClient({ baseUrl: ASSINAFY_API_BASE_URL, timeout: 10_000, maxRetries: 0 }).oauth.revokeToken({
      token,
      tokenTypeHint: 'access_token',
      clientId,
      clientSecret,
    });
  } catch (error) {
    console.warn(`[assinafy] ${operation}: revoke skipped`, {
      name: errorName(error),
    });
  }
};
