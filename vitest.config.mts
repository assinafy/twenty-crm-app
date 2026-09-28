import { fileURLToPath } from 'node:url';

import { DEV_API_KEY } from 'twenty-sdk/cli';
import { defineConfig } from 'vitest/config';

// Integration tests install the app on a live Twenty server and uninstall it afterwards.
// They default to the isolated test instance (`yarn twenty docker:start --test`), never the dev workspace.
const TWENTY_API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:2021';
// DEV_API_KEY is the seeded, dev-only workspace API key of the local Twenty test image.
const TWENTY_API_KEY = process.env.TWENTY_API_KEY ?? DEV_API_KEY;
// A key without a person, to prove routes refuse person-less calls. CI replaces TWENTY_API_KEY with an access token.
const TWENTY_WORKSPACE_API_KEY = process.env.TWENTY_WORKSPACE_API_KEY ?? DEV_API_KEY;

// App routes and logic function executions must run as a workspace member: they need the access token of a user (the
// seeded admin's in the test image). Without it, the suite falls back to TWENTY_API_KEY when that is an access token
// (as in CI) and fails otherwise.
const TWENTY_USER_ACCESS_TOKEN = process.env.TWENTY_USER_ACCESS_TOKEN ?? '';

// globalSetup reads process.env; test.env only reaches the workers.
process.env.TWENTY_API_URL = TWENTY_API_URL;
process.env.TWENTY_API_KEY = TWENTY_API_KEY;

export default defineConfig({
  resolve: { alias: [{ find: /^src\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }] },
  test: {
    testTimeout: 120_000,
    hookTimeout: 300_000,
    fileParallelism: false,
    include: ['src/**/*.integration-test.ts'],
    globalSetup: ['src/__tests__/integration/global-setup.ts'],
    env: { TWENTY_API_URL, TWENTY_API_KEY, TWENTY_USER_ACCESS_TOKEN, TWENTY_WORKSPACE_API_KEY },
  },
});
