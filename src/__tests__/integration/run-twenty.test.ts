import { beforeEach, describe, expect, it, vi } from 'vitest';

const run = vi.hoisted(() => vi.fn<(executable: string, args: string[], options: { env: NodeJS.ProcessEnv; timeout: number; maxBuffer: number }) => Promise<object>>());
vi.mock('node:util', () => ({ promisify: () => run }));

import { runTwenty } from 'src/__tests__/integration/run-twenty';

beforeEach(() => {
  run.mockReset().mockResolvedValue({});
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('TWENTY_API_URL', 'http://localhost:2021');
  vi.stubEnv('TWENTY_API_KEY', 'synthetic-test-key');
  vi.stubEnv('TWENTY_INTEGRATION_ALLOW_REMOTE', '');
});

describe('runTwenty', () => {
  it.each(['apply', 'uninstall'] as const)('targets the explicit test environment for %s', async (command) => {
    vi.stubEnv('TWENTY_REMOTE', 'production');
    await runTwenty(command, '/tmp/synthetic-app');
    const [executable, args, options] = run.mock.calls[0]!;
    expect(executable).toBe(process.execPath);
    expect(args.slice(1)).toEqual([
      'app', command, '--path', '/tmp/synthetic-app', '--yes', '--no-input', '--json',
      ...(command === 'apply' ? ['--create'] : []),
    ]);
    expect(options.env.TWENTY_REMOTE).toBeUndefined();
    expect(options.env.TWENTY_API_URL).toBe('http://localhost:2021');
    expect(options.env.TWENTY_API_KEY).toBe('synthetic-test-key');
    expect(options.timeout).toBe(300_000);
  });

  it.each([
    ['NODE_ENV', 'production'], ['TWENTY_API_URL', ''], ['TWENTY_API_KEY', ''],
    ['TWENTY_API_URL', 'http://localhost:2020'], ['TWENTY_API_URL', 'https://example.invalid'],
  ])('refuses unsafe or incomplete configuration: %s=%s', async (key, value) => {
    vi.stubEnv(key, value);
    await expect(runTwenty('uninstall', '/tmp/synthetic-app')).rejects.toThrow(/Twenty tests require|Refusing to modify/);
    expect(run).not.toHaveBeenCalled();
  });

  it('accepts an explicitly enabled remote test instance', async () => {
    vi.stubEnv('TWENTY_INTEGRATION_ALLOW_REMOTE', '1');
    vi.stubEnv('TWENTY_API_URL', 'https://example.invalid');
    await runTwenty('apply', '/tmp/synthetic-app');
    expect(run).toHaveBeenCalledOnce();
  });

  it('does not propagate CLI output or credentials on failure', async () => {
    run.mockRejectedValue(new Error('synthetic-test-key in stdout'));
    await expect(runTwenty('apply', '/tmp/synthetic-app')).rejects.toThrow(
      'Twenty test apply failed. Check the test server and CLI compatibility.',
    );
  });
});
