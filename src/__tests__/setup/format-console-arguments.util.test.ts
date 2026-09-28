import { describe, expect, it } from 'vitest';

import { formatConsoleArguments } from 'src/__tests__/setup/format-console-arguments.util';
import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';

const SECRET = LEAK_SENTINELS[0];

describe('formatConsoleArguments', () => {
  it('joins plain strings with spaces', () => {
    expect(formatConsoleArguments(['operation', 'failed'])).toBe('operation failed');
  });

  it.each([
    ['an error nested in an object', ['failed', { error: new Error(SECRET) }]],
    ['an error cause', [new Error('failed', { cause: new Error(SECRET) })]],
    [
      'a request config attached to an error',
      [Object.assign(new Error('failed'), { config: { headers: { Authorization: `Bearer ${SECRET}` } } })],
    ],
    ['a deeply nested value', [{ a: { b: { c: { d: { e: SECRET } } } } }]],
  ])('keeps a secret carried by %s', (_shape, args) => {
    expect(formatConsoleArguments(args)).toContain(SECRET);
  });
});
