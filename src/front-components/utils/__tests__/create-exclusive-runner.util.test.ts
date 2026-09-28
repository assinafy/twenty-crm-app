import { describe, expect, it, vi } from 'vitest';

import { createExclusiveRunner } from 'src/front-components/utils/create-exclusive-runner.util';

// A task that stays in flight until `finish` is called.
const pendingTask = () => {
  const finish: { resolve: () => void } = { resolve: () => undefined };
  const task = vi.fn<() => Promise<void>>(
    () =>
      new Promise<void>((resolve) => {
        finish.resolve = resolve;
      }),
  );

  return { task, finish: () => finish.resolve() };
};

describe('createExclusiveRunner', () => {
  it('ignores a run started while another is in flight', async () => {
    const run = createExclusiveRunner(vi.fn());
    const first = pendingTask();
    const second = vi.fn<() => Promise<void>>(async () => undefined);

    const running = run(first.task);
    await run(second);
    first.finish();
    await running;

    expect(first.task).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });

  it('hands an unexpected throw to onError instead of rejecting, and releases the lock', async () => {
    const onError = vi.fn<(error: unknown) => void>();
    const run = createExclusiveRunner(onError);
    const boom = new TypeError('crypto.randomUUID is not a function');
    const next = vi.fn<() => Promise<void>>(async () => undefined);

    await expect(run(() => Promise.reject(boom))).resolves.toBeUndefined();
    await run(next);

    expect(onError).toHaveBeenCalledExactlyOnceWith(boom);
    expect(next).toHaveBeenCalledOnce();
  });

  it('keeps a separate lock per runner', async () => {
    const first = pendingTask();
    const other = vi.fn<() => Promise<void>>(async () => undefined);

    const running = createExclusiveRunner(vi.fn())(first.task);
    await createExclusiveRunner(vi.fn())(other);
    first.finish();
    await running;

    expect(other).toHaveBeenCalledOnce();
  });
});
