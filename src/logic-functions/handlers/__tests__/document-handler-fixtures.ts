import { type AssinafyClient } from '@assinafy/sdk';

import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { type AssinafyCredential } from 'src/types/assinafy-credential';
import { type ResolvedCredential } from 'src/types/resolved-credential';

export const DOCUMENT_RECORD_ID = buildDocumentRecord().id;

export const sharedCredential: AssinafyCredential = {
  kind: 'shared',
  connectionId: 'connection-1',
  accessToken: LEAK_SENTINELS[0],
  scopes: [],
};

export const apiKeyCredential: AssinafyCredential = {
  kind: 'apiKey',
  apiKey: LEAK_SENTINELS[1],
  configuredAccountId: null,
};

export const buildResolved = (
  client: object = {},
  accountId = 'acc-1',
  credential: AssinafyCredential = sharedCredential,
): ResolvedCredential => ({ credential, accountId, accountName: 'Acme', client: client as AssinafyClient });
