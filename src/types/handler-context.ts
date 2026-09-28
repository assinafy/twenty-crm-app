import { type CoreApiClient } from 'twenty-client-sdk/core';
import { type MetadataApiClient } from 'twenty-client-sdk/metadata';

import { type CreateAssinafyClient } from 'src/types/create-assinafy-client';

// Dependencies injected into handlers by the logic-function wrappers (tests pass fakes).
export type HandlerContext = {
  // Acts as the person who triggered the run (their role intersected with the app role).
  userCore: CoreApiClient;
  // Acts as the application (sync writes, cron, workflow).
  appCore: CoreApiClient;
  appMetadata: MetadataApiClient;
  userWorkspaceId: string | null;
  now: () => Date;
  // Builds Assinafy clients; tests and the live suite inject a sandbox-bound factory.
  createAssinafyClient: CreateAssinafyClient;
};
