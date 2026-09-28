import { beforeEach, describe, expect, it, vi } from 'vitest';

const { store, getConnection, reportConnectionAuthFailure } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  getConnection: vi.fn<(connectionId: string) => Promise<unknown>>(),
  reportConnectionAuthFailure: vi.fn<(input: { connectionId: string; reason?: string }) => Promise<void>>(),
}));

vi.mock('twenty-sdk/logic-function', () => {
  class AppConnectionAuthFailedError extends Error {}

  return {
    AppConnectionAuthFailedError,
    getConnection,
    reportConnectionAuthFailure,
    kv: {
      get: vi.fn<(key: string) => Promise<unknown>>(async (key) => store.get(key) ?? null),
      set: vi.fn<(key: string, value: unknown) => Promise<void>>(async (key, value) => {
        store.set(key, value);
      }),
    },
  };
});

import { AppConnectionAuthFailedError, kv } from 'twenty-sdk/logic-function';

import { detectExpiredConnections } from 'src/assinafy-client/detect-expired-connections';
import { KV_KNOWN_CONNECTION_IDS } from 'src/constants/kv-keys';

const T0 = new Date('2026-09-25T10:00:00.000Z');
const minutesAfter = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const known = () => store.get(KV_KNOWN_CONNECTION_IDS);
const listed = (...ids: string[]) => ids.map((id) => ({ id, authFailedAt: null }));
const REFRESH_FAILED = 'getConnection() failed: Connection c1 could not be refreshed; ask the user to reconnect';

describe('detectExpiredConnections', () => {
  beforeEach(() => {
    store.clear();
    getConnection.mockReset();
    reportConnectionAuthFailure.mockReset();
  });

  it('remembers listed connections without probing them', async () => {
    await detectExpiredConnections(listed('c1', 'c2'), T0);

    expect(known()).toEqual({ c1: { missingSince: null }, c2: { missingSince: null } });
    expect(getConnection).not.toHaveBeenCalled();
  });

  it('does not rewrite the store when nothing changed', async () => {
    await detectExpiredConnections(listed('c1'), T0);
    vi.mocked(kv.set).mockClear();

    await detectExpiredConnections(listed('c1'), minutesAfter(5));

    expect(kv.set).not.toHaveBeenCalled();
  });

  it('does not rewrite the store when only the key order differs (jsonb reorders keys)', async () => {
    store.set(KV_KNOWN_CONNECTION_IDS, {
      c2: { missingSince: null },
      c1: { missingSince: T0.toISOString() },
    });
    vi.mocked(kv.set).mockClear();

    await detectExpiredConnections(listed('c2'), minutesAfter(5));

    expect(kv.set).not.toHaveBeenCalled();
  });

  it('waits an hour before probing a connection that disappeared', async () => {
    await detectExpiredConnections(listed('c1'), T0);
    await detectExpiredConnections([], minutesAfter(10));
    await detectExpiredConnections([], minutesAfter(59));

    expect(getConnection).not.toHaveBeenCalled();
    expect(known()).toEqual({ c1: { missingSince: minutesAfter(10).toISOString() } });
  });

  it('flags a connection still failing an hour later, once, then forgets it', async () => {
    getConnection.mockRejectedValue(new Error(REFRESH_FAILED));
    await detectExpiredConnections(listed('c1'), T0);
    await detectExpiredConnections([], minutesAfter(1));

    await detectExpiredConnections([], minutesAfter(62));
    await detectExpiredConnections([], minutesAfter(120));

    expect(reportConnectionAuthFailure).toHaveBeenCalledExactlyOnceWith({
      connectionId: 'c1',
      reason:
        'A Assinafy encerrou esta conexão: ela foi revogada, autorizada de novo com outras permissões ou ficou 30 ' +
        'dias sem uso. Reconecte para continuar.',
    });
    expect(getConnection).toHaveBeenCalledTimes(1);
    expect(known()).toEqual({});
  });

  it('describes a rolling 30-day expiry, not a fixed one', async () => {
    getConnection.mockRejectedValue(new Error(REFRESH_FAILED));
    store.set(KV_KNOWN_CONNECTION_IDS, { c1: { missingSince: T0.toISOString() } });

    await detectExpiredConnections([], minutesAfter(61));

    const reason = reportConnectionAuthFailure.mock.calls[0]?.[0].reason;
    expect(reason).toContain('30 dias sem uso');
    expect(reason).not.toMatch(/após a (autorização|aprovação)|a cada 30 dias/);
  });

  it('never re-flags a connection Twenty listed as flagged once it drops out of the listing', async () => {
    getConnection.mockRejectedValue(new Error(REFRESH_FAILED));
    await detectExpiredConnections([{ id: 'c1', authFailedAt: T0.toISOString() }], T0);
    await detectExpiredConnections([], minutesAfter(1));
    await detectExpiredConnections([], minutesAfter(62));

    expect(getConnection).not.toHaveBeenCalled();
    expect(reportConnectionAuthFailure).not.toHaveBeenCalled();
    expect(known()).toEqual({});
  });

  it('forgets a tracked connection once it is listed as flagged', async () => {
    store.set(KV_KNOWN_CONNECTION_IDS, { c1: { missingSince: null } });

    await detectExpiredConnections([{ id: 'c1', authFailedAt: T0.toISOString() }], T0);

    expect(known()).toEqual({});
  });

  it('tracks a reconnected connection again and flags it again if it expires again', async () => {
    getConnection.mockRejectedValue(new Error(REFRESH_FAILED));
    await detectExpiredConnections([{ id: 'c1', authFailedAt: T0.toISOString() }], T0);
    await detectExpiredConnections(listed('c1'), minutesAfter(10));
    expect(known()).toEqual({ c1: { missingSince: null } });

    await detectExpiredConnections([], minutesAfter(20));
    await detectExpiredConnections([], minutesAfter(81));

    expect(reportConnectionAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('forgets a connection that no longer exists', async () => {
    getConnection.mockRejectedValue(new Error('Connection not found'));
    store.set(KV_KNOWN_CONNECTION_IDS, { c1: { missingSince: T0.toISOString() } });

    await detectExpiredConnections([], minutesAfter(61));

    expect(reportConnectionAuthFailure).not.toHaveBeenCalled();
    expect(known()).toEqual({});
  });

  it('forgets without reporting again a connection Twenty already flagged', async () => {
    getConnection.mockRejectedValue(new AppConnectionAuthFailedError('c1'));
    store.set(KV_KNOWN_CONNECTION_IDS, { c1: { missingSince: T0.toISOString() } });

    await detectExpiredConnections([], minutesAfter(61));

    expect(reportConnectionAuthFailure).not.toHaveBeenCalled();
    expect(known()).toEqual({});
  });

  it('clears the missing mark of a connection that answers again', async () => {
    getConnection.mockResolvedValue({ id: 'c1' });
    store.set(KV_KNOWN_CONNECTION_IDS, { c1: { missingSince: T0.toISOString() } });

    await detectExpiredConnections([], minutesAfter(61));

    expect(known()).toEqual({ c1: { missingSince: null } });
  });

  it('ignores malformed stored state', async () => {
    store.set(KV_KNOWN_CONNECTION_IDS, ['legacy-array']);
    await detectExpiredConnections(listed('c1'), T0);
    expect(known()).toEqual({ c1: { missingSince: null } });

    store.set(KV_KNOWN_CONNECTION_IDS, { c2: 'bad', c3: null, c4: { missingSince: 5 } });
    await detectExpiredConnections([], T0);
    expect(known()).toEqual({});
  });

  it('drops a connection Twenty can no longer flag, and still flags the others', async () => {
    getConnection.mockRejectedValue(new Error(REFRESH_FAILED));
    reportConnectionAuthFailure.mockRejectedValueOnce(new Error('reportConnectionAuthFailure() failed: not found'));
    store.set(KV_KNOWN_CONNECTION_IDS, {
      c1: { missingSince: T0.toISOString() },
      c2: { missingSince: T0.toISOString() },
    });

    await detectExpiredConnections([], minutesAfter(61));

    expect(reportConnectionAuthFailure).toHaveBeenCalledTimes(2);
    expect(known()).toEqual({});
  });

  it.each([
    [new Error('reportConnectionAuthFailure() failed: HTTP 502 Bad Gateway'), 'Error'],
    ['boom', 'string'],
  ])('keeps a connection it failed to flag for the next run (%o)', async (error, name) => {
    getConnection.mockRejectedValue(new Error(REFRESH_FAILED));
    reportConnectionAuthFailure.mockRejectedValueOnce(error);
    store.set(KV_KNOWN_CONNECTION_IDS, {
      c1: { missingSince: T0.toISOString() },
      c2: { missingSince: T0.toISOString() },
    });

    await detectExpiredConnections(listed('c3'), minutesAfter(61));

    expect(console.warn).toHaveBeenCalledWith('[assinafy] reporting an expired connection failed', { name });
    expect(known()).toEqual({ c1: { missingSince: T0.toISOString() }, c3: { missingSince: null } });
  });

  it('never throws and logs only the error name', async () => {
    vi.mocked(kv.get).mockRejectedValueOnce(new TypeError('boom'));

    await expect(detectExpiredConnections(listed('c1'), T0)).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[assinafy] detectExpiredConnections failed', { name: 'TypeError' });
  });

  it('logs non-error failures by type', async () => {
    vi.mocked(kv.get).mockRejectedValueOnce('boom');

    await detectExpiredConnections([], T0);

    expect(console.warn).toHaveBeenCalledWith('[assinafy] detectExpiredConnections failed', { name: 'string' });
  });
});
