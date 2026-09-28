import { type AssinafyClient } from '@assinafy/sdk';

import { type AssinafyCredential } from 'src/types/assinafy-credential';

// A credential bound to its Assinafy workspace, with a client ready for account-scoped calls.
export type ResolvedCredential = {
  credential: AssinafyCredential;
  accountId: string;
  accountName: string;
  client: AssinafyClient;
};
