import { describe, expect, it } from 'vitest';

import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { AppFailure } from 'src/utils/app-failure.util';
import { toAppResult } from 'src/utils/to-app-result.util';

describe('toAppResult', () => {
  it('wraps data in a success envelope that cannot be overridden by the data', async () => {
    await expect(toAppResult('send', async () => ({ id: 'doc-1', ok: false }))).resolves.toEqual({
      ok: true,
      id: 'doc-1',
    });
  });

  it('turns an AppFailure into an error envelope without logging', async () => {
    const result = await toAppResult('send', async () => {
      throw new AppFailure('COST_CHANGED', 'Cost changed', { estimate: { totalCredits: 1 } });
    });

    expect(result).toEqual({
      ok: false,
      error: { code: 'COST_CHANGED', message: 'Cost changed', details: { estimate: { totalCredits: 1 } } },
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  it('hides unexpected errors behind INTERNAL and logs only the operation and error name', async () => {
    const result = await toAppResult('prepare', async () => {
      throw new TypeError(`token ${LEAK_SENTINELS[0]}`);
    });

    expect(result).toEqual({ ok: false, error: { code: 'INTERNAL', message: 'Erro inesperado.' } });
    expect(console.error).toHaveBeenCalledExactlyOnceWith('[assinafy] prepare failed', {
      code: 'INTERNAL',
      name: 'TypeError',
    });
  });

  it('logs the type of a non-Error throw', async () => {
    await toAppResult('refresh', () => Promise.reject(LEAK_SENTINELS[1]));

    expect(console.error).toHaveBeenCalledWith('[assinafy] refresh failed', { code: 'INTERNAL', name: 'string' });
  });
});
