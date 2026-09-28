import { describe, expect, it } from 'vitest';

import { SEND_LEASE_MS } from 'src/constants/limits';
import { isSendLeaseActive } from 'src/utils/is-send-lease-active.util';

const updatedAt = '2026-09-25T12:00:00.000Z';
const at = (offsetMs: number) => new Date(Date.parse(updatedAt) + offsetMs);

describe('isSendLeaseActive', () => {
  it('is active for a SENDING record inside the lease', () => {
    expect(isSendLeaseActive({ status: 'SENDING', updatedAt }, at(SEND_LEASE_MS - 1))).toBe(true);
  });

  it('expires at the lease boundary', () => {
    expect(isSendLeaseActive({ status: 'SENDING', updatedAt }, at(SEND_LEASE_MS))).toBe(false);
  });

  it('is inactive for other statuses', () => {
    expect(isSendLeaseActive({ status: 'PENDING_SIGNATURE', updatedAt }, at(0))).toBe(false);
    expect(isSendLeaseActive({ status: null, updatedAt }, at(0))).toBe(false);
  });

  it('is inactive when updatedAt cannot be parsed', () => {
    expect(isSendLeaseActive({ status: 'SENDING', updatedAt: 'not a date' }, at(0))).toBe(false);
  });
});
