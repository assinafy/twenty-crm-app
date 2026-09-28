import { inject } from 'vitest';

import { E2E_TWENTY_URL, SIM_URL } from 'src/__tests__/e2e/e2e-constants';
import { graphql } from 'src/__tests__/e2e/graphql';
import { poll } from 'src/__tests__/e2e/poll';
import { fetchInContainer } from 'src/__tests__/e2e/simulator-client';
import { executeLogicFunction, type InstalledApp, setAppVariable } from 'src/__tests__/integration/twenty-api';
import {
  ASSINAFY_ACCOUNT_ID_VARIABLE,
  ASSINAFY_API_KEY_VARIABLE,
  ASSINAFY_CONNECTION_PROVIDER_NAME,
} from 'src/constants/assinafy';
import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  SEND_FOR_SIGNATURE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  SYNC_DOCUMENTS_CRON_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// Values the global setup hands to the test files (vitest provide/inject). Generated per run; never logged.
declare module 'vitest' {
  export interface ProvidedContext {
    e2eAppCopyPath: string;
    simApiKey: string;
    simClientId: string;
    simClientSecret: string;
  }
}

export type E2eApp = InstalledApp & {
  applicationRegistrationId: string | null;
  healthCheckLogicFunctionId: string | null;
  frontComponents: Array<{
    id: string;
    universalIdentifier: string;
    builtComponentChecksum: string | null;
    frontComponentSharedDependenciesChecksum: string | null;
  }>;
  logicFunctions: Array<{ id: string; universalIdentifier: string; name: string }>;
  objects: Array<{ id: string; universalIdentifier: string; nameSingular: string }>;
};

const APP_QUERY = `query ($id: UUID!) { findOneApplication(universalIdentifier: $id) {
  id applicationRegistrationId healthCheckLogicFunctionId
  frontComponents { id universalIdentifier builtComponentChecksum frontComponentSharedDependenciesChecksum }
  logicFunctions { id universalIdentifier name }
  objects { id universalIdentifier nameSingular }
} }`;

// The sync applies some migrations after it returns, so the first read waits for the object to appear.
export const findE2eApp = (): Promise<E2eApp> =>
  poll(
    () =>
      graphql<{ findOneApplication: E2eApp }>('metadata', APP_QUERY, { id: APPLICATION_UNIVERSAL_IDENTIFIER }).then(
        ({ findOneApplication }) => findOneApplication,
        () => null,
      ),
    (app) => app?.objects.some((object) => object.universalIdentifier === ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER) ?? false,
    { timeoutMs: 60_000, label: 'the simulation build to be installed' },
  ) as Promise<E2eApp>;

export type HealthCheckResult = { status: string; title: string | null; description: string | null; action: { label: string } | null };

// UNKNOWN means the check itself failed (its Assinafy call has a 5 s budget, which a slow sandbox answer can exceed); it
// is retried a few times so only a stable outcome is asserted.
export const runHealthCheck = (app: E2eApp): Promise<HealthCheckResult> =>
  poll(
    async () =>
      (
        await graphql<{ runApplicationHealthCheck: HealthCheckResult }>(
          'metadata',
          'mutation ($id: UUID!) { runApplicationHealthCheck(applicationId: $id) { status title description action { label } } }',
          { id: app.id },
        )
      ).runApplicationHealthCheck,
    ({ status }) => status !== 'UNKNOWN',
    { timeoutMs: 60_000, intervalMs: 2_000, label: 'a health check outcome' },
  );

// Twenty memoizes workspace data, application variables included, for up to 10 s (MEMOIZER_TTL_MS), so a change can
// reach the functions late. Each switch waits until the health check, which reads the variables, sees it.
export const waitForHealthStatus = (app: E2eApp, status: HealthCheckResult['status'], label: string): Promise<HealthCheckResult> =>
  poll(() => runHealthCheck(app), (result) => result.status === status, { timeoutMs: 60_000, intervalMs: 1_000, label });

// The workspace API key of the simulator (forwarded upstream with the sandbox key) and the sandbox workspace.
export const useSimulatorApiKey = async (app: E2eApp): Promise<void> => {
  await setAppVariable(app, ASSINAFY_API_KEY_VARIABLE, inject('simApiKey'));
  await setAppVariable(app, ASSINAFY_ACCOUNT_ID_VARIABLE, process.env.ASSINAFY_SANDBOX_ACCOUNT_ID ?? '');
  await waitForHealthStatus(app, 'OK', 'the simulator API key to reach the functions');
};

// Only while no connection exists: then no credential is left and the health check warns.
export const clearApiKey = async (app: E2eApp): Promise<void> => {
  await setAppVariable(app, ASSINAFY_API_KEY_VARIABLE, '');
  await setAppVariable(app, ASSINAFY_ACCOUNT_ID_VARIABLE, '');
  await waitForHealthStatus(app, 'WARNING', 'the removed API key to reach the functions');
};

// The user-delegated application token a front component receives, so routes are called exactly as the UI calls them.
export const frontEndToken = async (app: E2eApp): Promise<string> => {
  const component = app.frontComponents.find(
    ({ universalIdentifier }) => universalIdentifier === SEND_FOR_SIGNATURE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  );
  const { frontComponent } = await graphql<{
    frontComponent: { applicationTokenPair: { applicationAccessToken: { token: string } } };
  }>('metadata', 'query ($id: UUID!) { frontComponent(id: $id) { applicationTokenPair { applicationAccessToken { token } } } }', {
    id: component?.id,
  });
  return frontComponent.applicationTokenPair.applicationAccessToken.token;
};

// The cron body, run on demand (as the member: Twenty offers no way to run it with the application token alone).
export const runSyncCron = async (app: E2eApp) => {
  const result = await executeLogicFunction(app, SYNC_DOCUMENTS_CRON_UNIVERSAL_IDENTIFIER);
  if (result.status !== 'SUCCESS') throw new Error(`The sync cron failed: ${JSON.stringify(result.error)}`);
  return result.data as { found: number; synced: number; failed: number; skipped: number; purged: number };
};

export type ConnectedAccount = {
  id: string;
  visibility: 'user' | 'workspace';
  scopes: string[];
  lastCredentialsRefreshedAt: string | null;
  authFailedAt: string | null;
  authFailedReason: string | null;
};

export const listConnectedAccounts = async (app: E2eApp): Promise<ConnectedAccount[]> =>
  (
    await graphql<{ applicationConnectedAccounts: ConnectedAccount[] }>(
      'metadata',
      `query ($id: UUID!) { applicationConnectedAccounts(applicationId: $id) {
        id visibility scopes lastCredentialsRefreshedAt authFailedAt authFailedReason } }`,
      { id: app.id },
    )
  ).applicationConnectedAccounts;

// Connects Assinafy the way the Settings page does, without a browser: Twenty's authorize endpoint redirects to the
// simulator (followed from inside the container, where it listens), which approves and redirects to Twenty's callback.
export const connectAssinafy = async (app: E2eApp, visibility: 'user' | 'workspace'): Promise<ConnectedAccount> => {
  const before = new Set((await listConnectedAccounts(app)).map(({ id }) => id));
  const { generateTransientToken } = await graphql<{ generateTransientToken: { transientToken: { token: string } } }>(
    'metadata',
    'mutation { generateTransientToken { transientToken { token } } }',
  );
  const query = new URLSearchParams({
    applicationId: app.id,
    providerName: ASSINAFY_CONNECTION_PROVIDER_NAME,
    transientToken: generateTransientToken.transientToken.token,
    visibility,
  });
  const authorize = await fetch(`${E2E_TWENTY_URL}/auth/apps/authorize?${query}`, { redirect: 'manual' });
  const toSimulator = authorize.headers.get('location') ?? '';
  if (!toSimulator.startsWith(`${SIM_URL}/oauth/authorize?`)) {
    throw new Error(`Twenty did not redirect to the simulator (status ${authorize.status}, ${redirectSummary(toSimulator)}).`);
  }
  const consent = await fetchInContainer(toSimulator);
  const toCallback = consent.location ?? '';
  if (consent.status !== 302 || !toCallback.startsWith(`${E2E_TWENTY_URL}/auth/apps/callback?code=`)) {
    throw new Error(`The simulator did not approve (status ${consent.status}, ${redirectSummary(toCallback)}).`);
  }
  const callback = await fetch(toCallback, { redirect: 'manual' });
  const landing = callback.headers.get('location') ?? '';
  if (landing.includes('errorMessage')) {
    throw new Error(`Twenty refused the callback: ${decodeURIComponent(new URL(landing).searchParams.get('errorMessage') ?? '')}`);
  }
  const [created] = (
    await poll(
      () => listConnectedAccounts(app),
      (accounts) => accounts.some(({ id }) => !before.has(id)),
      { timeoutMs: 20_000, label: 'the new connection' },
    )
  ).filter(({ id }) => !before.has(id));
  return created as ConnectedAccount;
};

// Only the path and the parameter names: the query carries codes and state.
const redirectSummary = (location: string): string => {
  if (!location) return 'no redirect';
  const url = new URL(location);
  return `${url.origin}${url.pathname} with ${[...url.searchParams.keys()].join(',')}`;
};

export const deleteConnectedAccount = (id: string) =>
  graphql('metadata', 'mutation ($id: UUID!) { deleteConnectedAccount(id: $id) { id } }', { id });
