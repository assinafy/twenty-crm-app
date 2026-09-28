import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';
import { BaseSequencer, type TestSpecification } from 'vitest/node';
import { DEV_API_KEY } from 'twenty-sdk/cli';
import { defineConfig } from 'vitest/config';

// Opt-in end-to-end suite: installs a simulation build of the app on the local Twenty test server (2021 only), with
// Assinafy simulated inside the test container on top of the sandbox. Sandbox credentials come from .env.
const TWENTY_API_URL = process.env.TWENTY_API_URL ?? 'http://localhost:2021';
// DEV_API_KEY is the seeded, dev-only workspace API key of the local Twenty test image.
const TWENTY_API_KEY = process.env.TWENTY_API_KEY ?? DEV_API_KEY;
const TWENTY_USER_ACCESS_TOKEN = process.env.TWENTY_USER_ACCESS_TOKEN ?? '';
const assinafyEnv = loadEnv('e2e', process.cwd(), 'ASSINAFY_');

// globalSetup reads process.env; test.env only reaches the workers.
Object.assign(process.env, { TWENTY_API_URL, TWENTY_API_KEY }, assinafyEnv);

// Scenarios build on each other (install, credentials, uninstall, reinstall), so files run one at a time by name.
class ByNameSequencer extends BaseSequencer {
  override async sort(files: TestSpecification[]) {
    return files.toSorted((a, b) => a.moduleId.localeCompare(b.moduleId));
  }
}

export default defineConfig({
  resolve: { alias: [{ find: /^src\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }] },
  test: {
    include: ['src/__tests__/e2e/**/*.e2e-test.ts'],
    testTimeout: 240_000,
    hookTimeout: 600_000,
    fileParallelism: false,
    sequence: { sequencer: ByNameSequencer },
    globalSetup: ['src/__tests__/e2e/global-setup.ts'],
    reporters: ['verbose'],
    env: { ...assinafyEnv, TWENTY_API_URL, TWENTY_API_KEY, TWENTY_USER_ACCESS_TOKEN },
  },
});
