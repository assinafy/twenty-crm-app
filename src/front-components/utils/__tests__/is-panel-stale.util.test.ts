import { describe, expect, it } from 'vitest';

import { isPanelStale } from 'src/front-components/utils/is-panel-stale.util';

const now = new Date('2026-09-25T12:00:00.000Z');
const record = (overrides: Partial<Parameters<typeof isPanelStale>[0]> = {}) => ({
  status: 'PENDING_SIGNATURE' as const,
  lastSyncedAt: '2026-09-25T11:55:00.000Z',
  assinafyDocumentId: 'doc-1',
  lastError: null,
  ...overrides,
});

describe('isPanelStale', () => {
  it('refreshes after five minutes, not at exactly five', () => {
    expect(isPanelStale(record(), now)).toBe(false);
    expect(isPanelStale(record({ lastSyncedAt: '2026-09-25T11:54:59.999Z' }), now)).toBe(true);
  });

  it('refreshes a document background sync cannot reach, even right after its last check', () => {
    expect(isPanelStale(record({ lastError: 'NO_CREDENTIAL' }), now)).toBe(true);
    expect(isPanelStale(record({ lastError: 'PROVIDER_UNAVAILABLE' }), now)).toBe(false);
  });

  it('refreshes a document never synced or with an unreadable sync date', () => {
    expect(isPanelStale(record({ lastSyncedAt: null }), now)).toBe(true);
    expect(isPanelStale(record({ lastSyncedAt: 'garbage' }), now)).toBe(true);
  });

  it.each(['CERTIFICATED', 'REJECTED_BY_SIGNER', 'CANCELLED', 'FAILED'] as const)(
    'never refreshes a %s document',
    (status) => {
      expect(isPanelStale(record({ status, lastSyncedAt: null }), now)).toBe(false);
    },
  );

  it('refreshes expired and unknown statuses', () => {
    expect(isPanelStale(record({ status: 'EXPIRED', lastSyncedAt: null }), now)).toBe(true);
    expect(isPanelStale(record({ status: null, lastSyncedAt: null }), now)).toBe(true);
  });

  it('skips records without an Assinafy document, except a send that may have outlived its lease', () => {
    expect(isPanelStale(record({ status: 'UNCERTAIN', assinafyDocumentId: null, lastSyncedAt: null }), now)).toBe(
      false,
    );
    expect(isPanelStale(record({ status: 'SENDING', assinafyDocumentId: null, lastSyncedAt: null }), now)).toBe(true);
  });
});
