import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: [{ find: /^src\//, replacement: fileURLToPath(new URL('./src/', import.meta.url)) }] },
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    setupFiles: ['src/__tests__/setup/unit-test-setup.ts'],
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: [
        'src/assinafy-client/**/*.ts',
        'src/data/**/*.ts',
        'src/services/**/*.ts',
        'src/utils/**/*.ts',
        'src/logic-functions/**/*.ts',
        'src/front-components/utils/**/*.ts',
        'src/fields/build-*.ts',
        'src/page-layout-tabs/build-*.ts',
        'src/command-menu-items/build-*.ts',
        'src/timeline-activity-types/build-*.ts',
      ],
      exclude: ['**/__tests__/**'],
      thresholds: { functions: 100, lines: 95, statements: 95, branches: 90 },
    },
  },
});
