import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';
import { DEV_API_KEY } from 'twenty-sdk/cli';
import { defineConfig } from 'vitest/config';

const loaded = loadEnv('production', process.cwd(), 'ASSINAFY_PRODUCTION_');
const production = {
  ASSINAFY_PRODUCTION_TESTS: loaded.ASSINAFY_PRODUCTION_TESTS ?? '',
  ASSINAFY_PRODUCTION_API_KEY: loaded.ASSINAFY_PRODUCTION_API_KEY ?? '',
  ASSINAFY_PRODUCTION_ACCOUNT_ID: loaded.ASSINAFY_PRODUCTION_ACCOUNT_ID ?? '',
};
if (production.ASSINAFY_PRODUCTION_TESTS !== '1') {
  throw new Error('Set ASSINAFY_PRODUCTION_TESTS=1 to explicitly enable the production contract test.');
}
if (!production.ASSINAFY_PRODUCTION_API_KEY || !production.ASSINAFY_PRODUCTION_ACCOUNT_ID) {
  throw new Error('Set ASSINAFY_PRODUCTION_API_KEY and ASSINAFY_PRODUCTION_ACCOUNT_ID for the production contract test.');
}

const TWENTY_API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:2021';
if (TWENTY_API_URL !== 'http://localhost:2021') {
  throw new Error('The production contract test installs the app only on http://localhost:2021.');
}
const TWENTY_API_KEY = process.env.TWENTY_API_KEY ?? DEV_API_KEY;
const TWENTY_WORKSPACE_API_KEY = process.env.TWENTY_WORKSPACE_API_KEY ?? DEV_API_KEY;
const TWENTY_USER_ACCESS_TOKEN = process.env.TWENTY_USER_ACCESS_TOKEN ?? '';

// The shared setup installs and uninstalls only the isolated local Twenty app. Provider credentials reach workers
// through this explicit allowlist and are configured on that app only by the test.
Object.assign(process.env, { TWENTY_API_URL, TWENTY_API_KEY });

export default defineConfig({
  resolve: { alias: [{ find: /^src\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }] },
  test: {
    include: ['src/__tests__/production/**/*.production-test.ts'],
    testTimeout: 120_000,
    hookTimeout: 300_000,
    fileParallelism: false,
    globalSetup: ['src/__tests__/integration/global-setup.ts'],
    env: { ...production, TWENTY_API_URL, TWENTY_API_KEY, TWENTY_USER_ACCESS_TOKEN, TWENTY_WORKSPACE_API_KEY },
  },
});
