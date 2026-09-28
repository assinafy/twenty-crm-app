import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { type LogicFunctionExecutionContext } from 'twenty-sdk/logic-function';

import { createAssinafyClient } from 'src/assinafy-client/create-assinafy-client';
import { type HandlerContext } from 'src/types/handler-context';

// Clients are built per invocation: they read the runtime env (API URL, tokens) when constructed.
export const buildHandlerContext = (executionContext: LogicFunctionExecutionContext): HandlerContext => ({
  userCore: new CoreApiClient(),
  appCore: new CoreApiClient({ runAs: 'application' }),
  appMetadata: new MetadataApiClient({ runAs: 'application' }),
  userWorkspaceId: executionContext.userWorkspaceId,
  now: () => new Date(),
  createAssinafyClient,
});
