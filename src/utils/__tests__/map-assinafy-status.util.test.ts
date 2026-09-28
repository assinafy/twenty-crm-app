import { describe, expect, it } from 'vitest';

import { mapAssinafyStatus } from 'src/utils/map-assinafy-status.util';

describe('mapAssinafyStatus', () => {
  it.each([
    ['uploading', 'PENDING_SIGNATURE', 'UNCERTAIN'],
    ['uploaded', 'PENDING_SIGNATURE', 'UNCERTAIN'],
    ['metadata_processing', 'PENDING_SIGNATURE', 'UNCERTAIN'],
    ['metadata_ready', 'PENDING_SIGNATURE', 'UNCERTAIN'],
    ['pending_signature', 'PENDING_SIGNATURE', 'PENDING_SIGNATURE'],
    ['certificating', 'CERTIFICATING', 'CERTIFICATING'],
    ['certificated', 'CERTIFICATED', 'CERTIFICATED'],
    ['rejected_by_signer', 'REJECTED_BY_SIGNER', 'REJECTED_BY_SIGNER'],
    ['rejected_by_user', 'CANCELLED', 'CANCELLED'],
    ['expired', 'EXPIRED', 'EXPIRED'],
    ['failed', 'FAILED', 'FAILED'],
    ['archived', 'UNKNOWN', 'UNKNOWN'],
    ['constructor', 'UNKNOWN', 'UNKNOWN'],
    ['', 'UNKNOWN', 'UNKNOWN'],
  ])('maps %o (sent → %s, unsent → %s)', (assinafyStatus, whenSent, whenUnsent) => {
    expect(mapAssinafyStatus(assinafyStatus, { sent: true })).toBe(whenSent);
    expect(mapAssinafyStatus(assinafyStatus, { sent: false })).toBe(whenUnsent);
  });

  it('ignores case', () => {
    expect(mapAssinafyStatus('Pending_Signature', { sent: true })).toBe('PENDING_SIGNATURE');
    expect(mapAssinafyStatus('METADATA_READY', { sent: true })).toBe('PENDING_SIGNATURE');
    expect(mapAssinafyStatus('Certificated', { sent: false })).toBe('CERTIFICATED');
  });
});
