import { CoreApiClient } from 'twenty-client-sdk/core';
import { MetadataApiClient } from 'twenty-client-sdk/metadata';
import { RestApiClient } from 'twenty-client-sdk/rest';
import { vi } from 'vitest';

import { ASSINAFY_ACCOUNT_ID_VARIABLE, ASSINAFY_API_KEY_VARIABLE } from 'src/constants/assinafy';
import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { callAppRoute } from 'src/front-components/utils/call-app-route.util';
import { type AppResult } from 'src/types/app-result';

const TWENTY_API_URL = process.env.TWENTY_API_URL ?? '';

const readTokenType = (token: string): unknown => {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')).type;
  } catch {
    return undefined;
  }
};

export const API_KEY = process.env.TWENTY_API_KEY ?? '';

// A workspace API key (no person). CI passes the seeded admin's access token as TWENTY_API_KEY, so it comes from
// TWENTY_WORKSPACE_API_KEY; the checks of person-less calls skip only when neither is an API key.
const workspaceApiKeyCandidate = process.env.TWENTY_WORKSPACE_API_KEY || API_KEY;
export const WORKSPACE_API_KEY = readTokenType(workspaceApiKeyCandidate) === 'API_KEY' ? workspaceApiKeyCandidate : '';
export const HAS_WORKSPACE_API_KEY = WORKSPACE_API_KEY !== '';

const resolveUserToken = (): string => {
  const token = process.env.TWENTY_USER_ACCESS_TOKEN || (readTokenType(API_KEY) === 'ACCESS' ? API_KEY : '');
  if (!token) {
    throw new Error("Set TWENTY_USER_ACCESS_TOKEN to a workspace member's access token (the seeded admin's).");
  }
  return token;
};

export const USER_TOKEN = resolveUserToken();

const authorization = (token: string) => ({ Authorization: `Bearer ${token}` });

export const coreClient = (token: string): CoreApiClient =>
  new CoreApiClient({ url: `${TWENTY_API_URL}/graphql`, headers: authorization(token) });

export const metadataClient = (token: string): MetadataApiClient =>
  new MetadataApiClient({ url: `${TWENTY_API_URL}/metadata`, headers: authorization(token) });

// The front end's own route client, pointed at the test server.
export const callRoute = <TData extends object = Record<string, unknown>>(
  path: `/s/assinafy/${string}`,
  token: string,
  body: object,
): Promise<AppResult<TData>> =>
  callAppRoute<TData>(path, body, new RestApiClient({ baseUrl: TWENTY_API_URL, token }));

export type InstalledApp = {
  id: string;
  logicFunctions: Array<{ id: string; universalIdentifier?: string }>;
  objects: Array<{ id: string; universalIdentifier: string }>;
};

// The sync applies some migrations after it returns, so the first read waits for the object to appear.
export const findInstalledApp = (): Promise<InstalledApp> =>
  vi.waitFor(
    async () => {
      // findManyApplications cannot select logicFunctions: the built-in applications answer null for it.
      const { findOneApplication: app } = await metadataClient(API_KEY).query({
        findOneApplication: {
          __args: { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER },
          id: true,
          logicFunctions: { id: true, universalIdentifier: true },
          objects: { id: true, universalIdentifier: true },
        },
      });
      if (!app.objects.some((object) => object.universalIdentifier === ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER)) {
        throw new Error('The Assinafy app is not installed on the test server yet.');
      }
      return app;
    },
    { timeout: 30_000, interval: 1_000 },
  );

// Looked up by universal identifier: other apps may ship functions with the same name.
export const findLogicFunctionId = (app: InstalledApp, universalIdentifier: string): string => {
  const id = app.logicFunctions.find((candidate) => candidate.universalIdentifier === universalIdentifier)?.id;
  if (!id) throw new Error(`Logic function ${universalIdentifier} is not installed.`);
  return id;
};

export const executeLogicFunction = async (
  app: InstalledApp,
  universalIdentifier: string,
  payload: Record<string, unknown> = {},
) => {
  const id = findLogicFunctionId(app, universalIdentifier);

  const { executeOneLogicFunction } = await metadataClient(USER_TOKEN).mutation({
    executeOneLogicFunction: {
      __args: { input: { id, payload } },
      status: true,
      data: true,
      error: true,
      logs: true,
    },
  });
  return executeOneLogicFunction;
};

export const setAppVariable = async (app: InstalledApp, key: string, value: string): Promise<void> => {
  await metadataClient(API_KEY).mutation({
    updateOneApplicationVariable: { __args: { key, value, applicationId: app.id } },
  });
};

// The */15 sync cron reads these: a test must never leave a credential behind.
export const clearAssinafyCredential = async (app: InstalledApp): Promise<void> => {
  await setAppVariable(app, ASSINAFY_API_KEY_VARIABLE, '');
  await setAppVariable(app, ASSINAFY_ACCOUNT_ID_VARIABLE, '');
};

// Runs the collected deletions newest first; one failure does not keep the others from running.
export const runCleanup = async (cleanup: Array<() => Promise<unknown>>): Promise<void> => {
  for (const undo of cleanup.splice(0).toReversed()) {
    await undo().catch((error: unknown) => console.warn('Integration cleanup step failed', error));
  }
};
