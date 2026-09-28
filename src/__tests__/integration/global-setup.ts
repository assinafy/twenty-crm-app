import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { appDevOnce, appUninstall } from 'twenty-sdk/cli';

import { destroyFixtureCompanies } from 'src/__tests__/integration/destroy-fixture-companies';

const APP_PATH = process.cwd();

const readServerEnv = () => {
  const apiUrl = process.env.TWENTY_API_URL;
  const apiKey = process.env.TWENTY_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('TWENTY_API_URL and TWENTY_API_KEY must be set (start one with `yarn twenty docker:start --test`).');
  }

  return { apiUrl, apiKey };
};

// Setup and teardown uninstall the app, which deletes its data, so only the local test instance is accepted unless
// TWENTY_INTEGRATION_ALLOW_REMOTE=1 opts in to another server (for example a test instance on another port).
const assertIsTestInstance = (apiUrl: string) => {
  // The CLI reads ~/.twenty/config.test.json only when NODE_ENV is "test"; otherwise it would sync to and uninstall
  // from the developer's default remote.
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Refusing to run the integration suite with NODE_ENV=${process.env.NODE_ENV}: the CLI would use the default remote.`);
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
    throw new Error(`No Twenty server answering at ${apiUrl}. Start the test instance with \`yarn twenty docker:start --test\`.`);
  }
};

// The CLI reads ~/.twenty/config.test.json when NODE_ENV is "test", so the developer's own remotes stay untouched.
const writeTestRemote = (apiUrl: string, apiKey: string) => {
  const configDirectory = join(homedir(), '.twenty');

  mkdirSync(configDirectory, { recursive: true });
  writeFileSync(
    join(configDirectory, 'config.test.json'),
    JSON.stringify({ remotes: { local: { apiUrl, apiKey, accessToken: apiKey } }, defaultRemote: 'local' }, null, 2),
  );
};

// Vitest runs teardown even when setup throws; it must not uninstall from a remote this run did not accept.
let isTestRemoteWritten = false;

export const setup = async () => {
  const { apiUrl, apiKey } = readServerEnv();

  assertIsTestInstance(apiUrl);
  await assertServerIsUp(apiUrl);
  writeTestRemote(apiUrl, apiKey);
  isTestRemoteWritten = true;

  await appUninstall({ appPath: APP_PATH }).catch(() => undefined);

  const result = await appDevOnce({ appPath: APP_PATH, apply: true, force: true });

  if (!result.success) {
    throw new Error(`Sync failed: ${result.error.message}`);
  }
};

export const teardown = async () => {
  if (!isTestRemoteWritten) {
    return;
  }

  const { apiUrl, apiKey } = readServerEnv();
  await destroyFixtureCompanies(apiUrl, apiKey).catch((error: unknown) =>
    console.warn(`Fixture company cleanup after the integration run failed: ${error instanceof Error ? error.message : String(error)}`),
  );

  const result = await appUninstall({ appPath: APP_PATH });

  if (!result.success) {
    console.warn(`Uninstall after the integration run failed: ${result.error.message}`);
  }
};
