import { describe, expect, it } from 'vitest';

import { SEND_LEASE_MS } from 'src/constants/limits';
import { isWithinSendLease } from 'src/utils/is-within-send-lease.util';

const updatedAt = '2026-09-25T12:00:00.000Z';
const at = (offsetMs: number) => new Date(Date.parse(updatedAt) + offsetMs);

describe('isWithinSendLease', () => {
  it('holds until the lease boundary', () => {
    expect(isWithinSendLease(updatedAt, at(SEND_LEASE_MS - 1))).toBe(true);
    expect(isWithinSendLease(updatedAt, at(SEND_LEASE_MS))).toBe(false);
  });

  it('is false when updatedAt cannot be parsed', () => {
    expect(isWithinSendLease('not a date', at(0))).toBe(false);
  });
});
