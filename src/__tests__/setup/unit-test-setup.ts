import { afterEach, beforeEach, vi } from 'vitest';

import { formatConsoleArguments } from 'src/__tests__/setup/format-console-arguments.util';

// Values unit tests use as credentials and signing links. None of them may ever reach a log line.
export const LEAK_SENTINELS = [
  'test-access-token-7f3a',
  'test-api-key-9c1e',
  'test-client-secret-4b2d',
  'https://sign.test.invalid/secret-link',
] as const;

let logged: string[] = [];

beforeEach(() => {
  logged = [];
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      logged.push(formatConsoleArguments(args));
    });
  }
});

afterEach(() => {
  const leaks = logged.filter((line) => LEAK_SENTINELS.some((sentinel) => line.includes(sentinel)));

  if (leaks.length > 0) {
    throw new Error(`A secret reached the console:\n${leaks.join('\n')}`);
  }
});
