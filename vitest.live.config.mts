import { fileURLToPath } from 'node:url';

import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// Opt-in suite against the Assinafy sandbox. Credentials come only from the environment (see .env.example).
export default defineConfig({
  resolve: { alias: [{ find: /^src\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }] },
  test: {
    include: ['src/**/*.live-test.ts'],
    testTimeout: 180_000,
    // afterAll deletes the uploads a run left in the sandbox, two calls each.
    hookTimeout: 300_000,
    fileParallelism: false,
    reporters: ['default'],
    env: loadEnv('live', process.cwd(), 'ASSINAFY_'),
  },
});
