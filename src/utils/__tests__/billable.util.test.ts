import { ApiError, NetworkError } from '@assinafy/sdk';
import { describe, expect, it, vi } from 'vitest';

import { billable } from 'src/utils/billable.util';

describe('billable', () => {
  it('returns the result of the call, made once', async () => {
    const call = vi.fn<() => Promise<string>>(async () => 'sent');

    await expect(billable(call)).resolves.toBe('sent');
    expect(call).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a network error', new NetworkError('socket hang up'), 'UNCERTAIN'],
    ['HTTP 409', new ApiError('Conflict', 409), 'UNCERTAIN'],
    ['an unexpected error', new TypeError('Cannot read properties of undefined'), 'UNCERTAIN'],
    ['a definitive rejection', new ApiError('Rejected', 422), 'PROVIDER_REJECTED'],
  ])('maps %s as a billable failure, without retrying', async (_label, error, code) => {
    const call = vi.fn<() => Promise<never>>(async () => {
      throw error;
    });

    await expect(billable(call)).rejects.toMatchObject({ code });
    expect(call).toHaveBeenCalledTimes(1);
  });
});
