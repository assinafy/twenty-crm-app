import { describe, expect, it } from 'vitest';

import { getSendDeadline } from 'src/utils/get-send-deadline.util';

describe('getSendDeadline', () => {
  it('ends 10 seconds before the send timeout', () => {
    expect(getSendDeadline(new Date(0))).toBe((120 - 10) * 1000);
  });
});
