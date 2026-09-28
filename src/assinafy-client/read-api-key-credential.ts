import { ASSINAFY_ACCOUNT_ID_VARIABLE, ASSINAFY_API_KEY_VARIABLE } from 'src/constants/assinafy';
import { type AssinafyCredential } from 'src/types/assinafy-credential';

export const readApiKeyCredential = (): AssinafyCredential | null => {
  const apiKey = process.env[ASSINAFY_API_KEY_VARIABLE]?.trim();
  if (!apiKey) return null;

  return { kind: 'apiKey', apiKey, configuredAccountId: process.env[ASSINAFY_ACCOUNT_ID_VARIABLE]?.trim() || null };
};
