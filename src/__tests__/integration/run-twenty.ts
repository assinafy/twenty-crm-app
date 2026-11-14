import { execFile } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';

// Always target the explicitly configured test server, never a developer's saved remote.
export const runTwenty = async (command: 'apply' | 'uninstall', appPath: string): Promise<void> => {
  const { TWENTY_API_URL: apiUrl, TWENTY_API_KEY: apiKey } = process.env;
  if (process.env.NODE_ENV !== 'test' || !apiUrl || !apiKey) {
    throw new Error('Twenty tests require NODE_ENV=test, TWENTY_API_URL and TWENTY_API_KEY.');
  }
  const { hostname, port } = new URL(apiUrl);
  if ((!['localhost', '127.0.0.1'].includes(hostname) || port !== '2021') && process.env.TWENTY_INTEGRATION_ALLOW_REMOTE !== '1') {
    throw new Error('Refusing to modify a Twenty instance outside localhost:2021.');
  }
  const cli = join(dirname(createRequire(import.meta.url).resolve('twenty/package.json')), 'dist/cli.cjs');
  const env = { ...process.env };
  delete env.TWENTY_REMOTE;
  try {
    await promisify(execFile)(process.execPath, [
      cli, 'app', command, '--path', appPath, '--yes', '--no-input', '--json',
      ...(command === 'apply' ? ['--create'] : []),
    ], { env, timeout: 300_000, maxBuffer: 4 * 1024 * 1024 });
  } catch {
    // Child-process errors include stdout/stderr, which may contain credentials or provider content.
    throw new Error(`Twenty test ${command} failed. Check the test server and CLI compatibility.`);
  }
};
