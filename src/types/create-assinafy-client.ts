import { type AssinafyClient } from '@assinafy/sdk';

import { type AssinafyCredential } from 'src/types/assinafy-credential';

export type CreateAssinafyClient = (
  credential: AssinafyCredential,
  options?: { accountId?: string; timeoutMs?: number; maxRetries?: number },
) => AssinafyClient;
