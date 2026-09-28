import { describe, expect, it, vi } from 'vitest';

import { prepareAfterDiscard } from 'src/front-components/utils/prepare-after-discard.util';

describe('prepareAfterDiscard', () => {
  it('starts the prepare only once the discard has answered, even a refused one', async () => {
    const answers: Array<(value: unknown) => void> = [];
    const promise = new Promise<unknown>((resolve) => answers.push(resolve));
    const discard = vi.fn<() => Promise<unknown>>(() => promise);
    const prepare = vi.fn<() => Promise<string>>(async () => 'prepared');

    const running = prepareAfterDiscard(discard, prepare);
    await Promise.resolve();

    expect(discard).toHaveBeenCalledOnce();
    expect(prepare).not.toHaveBeenCalled();

    answers[0]?.({ ok: false, error: { code: 'INVALID_STATE', message: '' } });

    await expect(running).resolves.toBe('prepared');
    expect(prepare).toHaveBeenCalledOnce();
  });

  it('prepares right away when there is nothing to discard', async () => {
    await expect(prepareAfterDiscard(null, async () => 'prepared')).resolves.toBe('prepared');
  });
});
