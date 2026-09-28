import { vi } from 'vitest';

// In-memory stand-in for the twenty-sdk kv, shared by the pending-upload tests (use inside vi.hoisted/vi.mock).
export const createKvStore = () => {
  const store = new Map<string, unknown>();
  const kv = {
    get: vi.fn<(key: string) => Promise<unknown>>(async (key) => store.get(key) ?? null),
    set: vi.fn<(key: string, value: unknown) => Promise<void>>(async (key, value) => {
      store.set(key, value);
    }),
  };
  return { store, kv };
};
