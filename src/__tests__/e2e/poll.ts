// Retries `read` until `done` accepts its value, then returns it; fails with the last value after the timeout.
export const poll = async <T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  { timeoutMs = 60_000, intervalMs = 1_000, label = 'condition' } = {},
): Promise<T> => {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await read();
    if (done(value)) return value;
    if (Date.now() > deadline) {
      throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(value)?.slice(0, 500)}`);
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
};
