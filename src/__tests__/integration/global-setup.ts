import { type TestProject } from 'vitest/node';

import { createTestWorkspaceKey } from 'src/__tests__/integration/create-test-workspace-key';
import { runTwenty } from 'src/__tests__/integration/run-twenty';

import { destroyFixtureCompanies } from 'src/__tests__/integration/destroy-fixture-companies';

const APP_PATH = process.cwd();

const readServerEnv = () => {
  const apiUrl = process.env.TWENTY_API_URL;
  const apiKey = process.env.TWENTY_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('TWENTY_API_URL and TWENTY_API_KEY must be set (start one with `yarn twenty local start --test`).');
  }

  return { apiUrl, apiKey };
};

// Setup and teardown uninstall the app, which deletes its data, so only the local test instance is accepted unless
// TWENTY_INTEGRATION_ALLOW_REMOTE=1 opts in to another server (for example a test instance on another port).
const assertIsTestInstance = (apiUrl: string) => {
  // Keep test-only mutations unavailable outside the test runner.
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Refusing to run the integration suite with NODE_ENV=${process.env.NODE_ENV}: test-only mutations are disabled.`);
  }
  const { hostname, port, origin } = new URL(apiUrl);
  const isLocalTestInstance = ['localhost', '127.0.0.1'].includes(hostname) && port === '2021';

  if (!isLocalTestInstance && process.env.TWENTY_INTEGRATION_ALLOW_REMOTE !== '1') {
    throw new Error(
      `Refusing to run the integration suite against ${origin}: it uninstalls the app there. Use the test instance on http://localhost:2021 or set TWENTY_INTEGRATION_ALLOW_REMOTE=1.`,
    );
  }
};

const assertServerIsUp = async (apiUrl: string) => {
  const response = await fetch(`${apiUrl}/healthz`).catch(() => null);

  if (!response?.ok) {
    throw new Error(`No Twenty server answering at ${apiUrl}. Start the test instance with \`yarn twenty local start --test\`.`);
  }
};

// Vitest runs teardown even when setup throws; it must not uninstall from an instance this run did not accept.
let isTestInstanceAccepted = false;
let revokeWorkspaceKey: (() => Promise<void>) | undefined;

export const setup = async (project: TestProject) => {
  const { apiUrl, apiKey } = readServerEnv();

  assertIsTestInstance(apiUrl);
  await assertServerIsUp(apiUrl);
  isTestInstanceAccepted = true;

  await runTwenty('uninstall', APP_PATH).catch(() => undefined);
  await runTwenty('apply', APP_PATH);
  if (!process.env.TWENTY_WORKSPACE_API_KEY) {
    const key = await createTestWorkspaceKey(apiUrl, process.env.TWENTY_USER_ACCESS_TOKEN || apiKey);
    revokeWorkspaceKey = key.revoke;
    project.provide('workspaceApiKey', key.token);
  }
};

export const teardown = async () => {
  if (!isTestInstanceAccepted) {
    return;
  }

  const { apiUrl, apiKey } = readServerEnv();
  await destroyFixtureCompanies(apiUrl, apiKey).catch((error: unknown) =>
    console.warn(`Fixture company cleanup after the integration run failed: ${error instanceof Error ? error.message : String(error)}`),
  );

  try {
    await runTwenty('uninstall', APP_PATH);
  } finally {
    await revokeWorkspaceKey?.();
    revokeWorkspaceKey = undefined;
  }
};
