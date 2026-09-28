import { describe, expect, it } from 'vitest';

import { isFinalStatus } from 'src/utils/is-final-status.util';

describe('isFinalStatus', () => {
  it.each(['CERTIFICATED', 'REJECTED_BY_SIGNER', 'CANCELLED', 'FAILED'])('is true for %s', (status) => {
    expect(isFinalStatus(status)).toBe(true);
  });

  it.each(['PENDING_SIGNATURE', 'EXPIRED', 'UNCERTAIN', null])('is false for %s', (status) => {
    expect(isFinalStatus(status)).toBe(false);
  });
});
