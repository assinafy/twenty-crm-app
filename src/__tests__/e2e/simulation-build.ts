import { cp, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import { appDevOnce } from 'twenty-sdk/cli';

import { CRON_REWRITE, ENDPOINT_REWRITES } from 'src/__tests__/e2e/e2e-constants';

const EXCLUDED_TOP_LEVEL = new Set(['node_modules', '.git', '.twenty', 'coverage', '.env']);

// Copies the app to a temporary folder, points only that copy's three Assinafy endpoints at the simulator and parks its
// scheduled sync. The repository (and anything published from it) keeps the production values; each literal must be
// found exactly once.
export const createSimulationCopy = async (appPath: string): Promise<string> => {
  const copyPath = await mkdtemp(join(tmpdir(), 'assinafy-e2e-'));
  try {
    await cp(appPath, copyPath, {
      recursive: true,
      filter: (source) => source === appPath || !EXCLUDED_TOP_LEVEL.has(basename(source)) || !isTopLevel(appPath, source),
    });
    await symlink(join(appPath, 'node_modules'), join(copyPath, 'node_modules'), 'dir');

    await rewriteExactlyOnce(copyPath, 'src/constants/assinafy.ts', ENDPOINT_REWRITES);
    await rewriteExactlyOnce(copyPath, 'src/logic-functions/sync-assinafy-documents.logic-function.ts', [CRON_REWRITE]);
    return copyPath;
  } catch (error) {
    await rm(copyPath, { recursive: true, force: true });
    throw error;
  }
};

const rewriteExactlyOnce = async (copyPath: string, file: string, rewrites: Array<{ from: string; to: string }>) => {
  const path = join(copyPath, file);
  let source = await readFile(path, 'utf8');
  for (const { from, to } of rewrites) {
    const occurrences = source.split(from).length - 1;
    if (occurrences !== 1) {
      throw new Error(`Expected the production literal ${from} exactly once in ${file}, found ${occurrences}.`);
    }
    source = source.replace(from, to);
  }
  await writeFile(path, source);
};

const isTopLevel = (appPath: string, source: string): boolean => join(appPath, basename(source)) === source;

// Installs (or upgrades) the app from `appPath` on the CLI's test remote (~/.twenty/config.test.json).
export const syncApp = async (appPath: string): Promise<void> => {
  const result = await appDevOnce({ appPath, apply: true, force: true });
  if (!result.success) throw new Error(`Sync of the simulation build failed: ${result.error.message}`);
};
