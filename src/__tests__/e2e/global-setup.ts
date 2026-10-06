import { randomBytes } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { type TestProject } from 'vitest/node';

import { dockerExec } from 'src/__tests__/e2e/docker-exec';
import {
  E2E_CONTAINER,
  E2E_TWENTY_URL,
  OUTBOUND_HOSTS_CONFIG_KEY,
  SIM_LOG_IN_CONTAINER,
  SIM_PATH_IN_CONTAINER,
  SIM_PORT,
} from 'src/__tests__/e2e/e2e-constants';
import { graphql } from 'src/__tests__/e2e/graphql';
import { poll } from 'src/__tests__/e2e/poll';
import { listRegistrationVariables, setRegistrationVariable } from 'src/__tests__/e2e/registration-variables';
import { cleanUpSandboxDocuments } from 'src/__tests__/e2e/sandbox-cleanup';
import { createSimulationCopy, syncApp } from 'src/__tests__/e2e/simulation-build';
import { simulator } from 'src/__tests__/e2e/simulator-client';
import { uninstallApp } from 'src/__tests__/e2e/uninstall-app';
import { SANDBOX_BASE_URL } from 'src/__tests__/fixtures/sandbox-base-url';
import { destroyFixtureCompanies } from 'src/__tests__/integration/destroy-fixture-companies';
import {
  ASSINAFY_ACCOUNT_ID_VARIABLE,
  ASSINAFY_API_KEY_VARIABLE,
  ASSINAFY_CLIENT_ID_VARIABLE,
  ASSINAFY_CLIENT_SECRET_VARIABLE,
} from 'src/constants/assinafy';
import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { errorName } from 'src/utils/error-name.util';

const APP_PATH = process.cwd();
const SIMULATOR_SOURCE = join(APP_PATH, 'src/__tests__/e2e/simulator/assinafy-simulator.mjs');
const keepInstalled = process.env.E2E_KEEP_INSTALLED === '1';

const required = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set. The end-to-end suite needs it (see SETUP.md, End-to-end suite).`);
  return value;
};

// Every step below changes the server, so only the local test instance is accepted, and its container must be the
// one serving it.
const assertTestInstance = async () => {
  // The CLI syncs to ~/.twenty/config.test.json only when NODE_ENV is "test"; otherwise it would use the developer's
  // default remote.
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Refusing to run the end-to-end suite with NODE_ENV=${process.env.NODE_ENV}: the CLI would sync to the default remote.`);
  }
  if (process.env.TWENTY_API_URL !== E2E_TWENTY_URL) {
    throw new Error(`Refusing to run the end-to-end suite against ${process.env.TWENTY_API_URL}: only ${E2E_TWENTY_URL} is allowed.`);
  }
  const response = await fetch(`${E2E_TWENTY_URL}/healthz`).catch(() => null);
  if (!response?.ok) {
    throw new Error(`No Twenty server answering at ${E2E_TWENTY_URL}. Start it with \`yarn twenty docker:start --test\`.`);
  }
  const serverUrl = (await dockerExec(['sh', '-c', 'echo "$SERVER_URL"'])).trim();
  if (serverUrl !== E2E_TWENTY_URL) {
    throw new Error(`Container ${E2E_CONTAINER} serves ${serverUrl}, not ${E2E_TWENTY_URL}.`);
  }
};

// The CLI reads ~/.twenty/config.test.json when NODE_ENV is "test", so the developer's own remotes stay untouched.
const writeTestRemote = () => {
  const directory = join(homedir(), '.twenty');
  mkdirSync(directory, { recursive: true });
  writeFileSync(
    join(directory, 'config.test.json'),
    JSON.stringify({ remotes: { local: { apiUrl: E2E_TWENTY_URL, apiKey: required('TWENTY_API_KEY') } }, defaultRemote: 'local' }, null, 2),
  );
};

// The bracket keeps pkill from matching the shell running it.
const stopSimulator = () => dockerExec(['sh', '-c', `pkill -f '[n]ode ${SIM_PATH_IN_CONTAINER}' || true`]);

const startSimulator = async (secrets: { simApiKey: string; simClientId: string; simClientSecret: string }) => {
  await stopSimulator();
  await promisify(execFile)('docker', ['cp', SIMULATOR_SOURCE, `${E2E_CONTAINER}:${SIM_PATH_IN_CONTAINER}`]);
  await dockerExec(['sh', '-c', `node ${SIM_PATH_IN_CONTAINER} > ${SIM_LOG_IN_CONTAINER} 2>&1`], {
    detach: true,
    env: {
      // Loopback only: Twenty, its worker and the logic functions all reach it from inside the container.
      SIM_HOST: '127.0.0.1',
      SIM_PORT: String(SIM_PORT),
      SIM_UPSTREAM: SANDBOX_BASE_URL,
      SIM_UPSTREAM_API_KEY: required('ASSINAFY_SANDBOX_API_KEY'),
      SIM_ACCOUNT_ID: required('ASSINAFY_SANDBOX_ACCOUNT_ID'),
      SIM_API_KEY: secrets.simApiKey,
      SIM_CLIENT_ID: secrets.simClientId,
      SIM_CLIENT_SECRET: secrets.simClientSecret,
    },
  });
  await poll(
    () => simulator.health().catch(() => ({ ok: false })),
    ({ ok }) => ok,
    { timeoutMs: 20_000, intervalMs: 500, label: 'the simulator to answer /__sim/health' },
  );
};

// Twenty's own OAuth calls (code exchange, refresh) go through its SSRF guard, which blocks loopback by default.
const setOutboundAllowlist = async () => {
  await deleteOutboundAllowlist();
  await graphql('admin-panel', 'mutation ($key: String!, $value: JSON!) { createDatabaseConfigVariable(key: $key, value: $value) }', {
    key: OUTBOUND_HOSTS_CONFIG_KEY,
    value: ['localhost'],
  });
};

const deleteOutboundAllowlist = () =>
  graphql('admin-panel', 'mutation ($key: String!) { deleteDatabaseConfigVariable(key: $key) }', {
    key: OUTBOUND_HOSTS_CONFIG_KEY,
  }).catch(() => undefined);

const setSimulatorApiKey = async () => {
  const { findOneApplication } = await graphql<{ findOneApplication: { id: string } }>(
    'metadata',
    'query ($id: UUID!) { findOneApplication(universalIdentifier: $id) { id } }',
    { id: APPLICATION_UNIVERSAL_IDENTIFIER },
  );
  for (const [key, value] of [
    [ASSINAFY_API_KEY_VARIABLE, simApiKey],
    [ASSINAFY_ACCOUNT_ID_VARIABLE, required('ASSINAFY_SANDBOX_ACCOUNT_ID')],
  ]) {
    await graphql('metadata', 'mutation ($key: String!, $value: String!, $id: UUID) { updateOneApplicationVariable(key: $key, value: $value, applicationId: $id) }', {
      key,
      value,
      id: findOneApplication.id,
    });
  }
};

const resetRegistrationVariables = async () => {
  const filled = (await listRegistrationVariables()).filter(({ isFilled }) => isFilled);
  for (const { key } of filled) {
    if (key === ASSINAFY_CLIENT_ID_VARIABLE || key === ASSINAFY_CLIENT_SECRET_VARIABLE) await setRegistrationVariable(key, null);
  }
};

// Teardown runs even when setup throws; it only touches what setup got to change.
let accepted = false;
let appCopyPath: string | null = null;
let simApiKey = '';

export const setup = async (project: TestProject) => {
  required('TWENTY_USER_ACCESS_TOKEN');
  required('ASSINAFY_SANDBOX_API_KEY');
  required('ASSINAFY_SANDBOX_ACCOUNT_ID');
  await assertTestInstance();
  accepted = true;

  simApiKey = `sim-api-key-${randomBytes(12).toString('hex')}`;
  const secrets = {
    simApiKey,
    simClientId: `sim-client-${randomBytes(6).toString('hex')}`,
    simClientSecret: `sim-secret-${randomBytes(16).toString('hex')}`,
  };

  writeTestRemote();
  // A previous run left with E2E_KEEP_INSTALLED, or one that crashed, is replaced from scratch.
  await uninstallApp().catch(() => undefined);
  await resetRegistrationVariables();
  await startSimulator(secrets);
  await setOutboundAllowlist();

  appCopyPath = await createSimulationCopy(APP_PATH);
  await syncApp(appCopyPath);

  project.provide('e2eAppCopyPath', appCopyPath);
  project.provide('simApiKey', secrets.simApiKey);
  project.provide('simClientId', secrets.simClientId);
  project.provide('simClientSecret', secrets.simClientSecret);
};

const step = async (label: string, run: () => Promise<unknown>) => {
  try {
    await run();
  } catch (error) {
    console.warn(`[e2e] teardown: ${label} failed`, { code: 'CLEANUP_FAILED', name: errorName(error) });
  }
};

export const teardown = async () => {
  if (!accepted) return;

  await step('sandbox cleanup', async () => {
    const deleted = await cleanUpSandboxDocuments(await simulator.log(), required('ASSINAFY_SANDBOX_API_KEY'));
    console.warn(`[e2e] teardown: deleted ${deleted} open sandbox document(s) left by the run`);
  });

  if (keepInstalled) {
    await step('API key for the manual check', setSimulatorApiKey);
    console.warn(
      [
        '[e2e] E2E_KEEP_INSTALLED=1: the simulation build stays installed on http://localhost:2021, with its Assinafy API key',
        `variable set to the simulator's key, and the simulator keeps running in ${E2E_CONTAINER} (log: ${SIM_LOG_IN_CONTAINER}).`,
        'Sign in at http://localhost:2021 with the seeded admin account; the app\'s Assinafy calls go through the simulator to the',
        'sandbox. OAuth "Add connection" does not work from a browser: it redirects to the simulator port, which is not',
        'published. Run `yarn test:e2e` again without E2E_KEEP_INSTALLED to restore the server.',
      ].join('\n'),
    );
  } else {
    // Uninstalling first lets the uninstall hook revoke the access tokens while the simulator and the OAuth client exist.
    await step('uninstall', uninstallApp);
    await step('registration variables reset', resetRegistrationVariables);
    await step('config variable removal', deleteOutboundAllowlist);
    await step('simulator stop', async () => {
      await stopSimulator();
      await dockerExec(['rm', '-f', SIM_PATH_IN_CONTAINER, SIM_LOG_IN_CONTAINER]);
    });
  }

  // Last, so the seeded workflow has had the whole teardown to create the companies it makes for the fixtures.
  await step('fixture company cleanup', () =>
    destroyFixtureCompanies(E2E_TWENTY_URL, process.env.TWENTY_USER_ACCESS_TOKEN ?? ''),
  );
  if (appCopyPath) await step('temporary copy removal', () => rm(appCopyPath ?? '', { recursive: true, force: true }));
};
