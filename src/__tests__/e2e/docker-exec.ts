import { execFile } from 'node:child_process';

import { E2E_CONTAINER } from 'src/__tests__/e2e/e2e-constants';

// Runs a command in the test container. Values in `env` reach the command by name only (`docker exec -e NAME`), so they
// never appear on a command line.
export const dockerExec = (
  command: string[],
  { env = {}, input, detach = false }: { env?: Record<string, string>; input?: string; detach?: boolean } = {},
): Promise<string> =>
  new Promise((resolve, reject) => {
    const args = [
      'exec',
      ...(input === undefined ? [] : ['-i']),
      ...(detach ? ['-d'] : []),
      ...Object.keys(env).flatMap((name) => ['-e', name]),
      E2E_CONTAINER,
      ...command,
    ];
    const child = execFile(
      'docker',
      args,
      { env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`docker exec ${command[0]} failed (exit ${String(error.code)}): ${stderr.slice(0, 500)}`));
          return;
        }
        resolve(stdout);
      },
    );
    if (input !== undefined) child.stdin?.end(input);
  });
