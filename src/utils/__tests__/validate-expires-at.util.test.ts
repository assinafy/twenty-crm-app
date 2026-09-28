import { describe, expect, it } from 'vitest';

import { validateExpiresAt } from 'src/utils/validate-expires-at.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });
const now = new Date('2026-09-25T12:00:00.000Z');

describe('validateExpiresAt', () => {
  it.each([undefined, null, '', '  '])('reads %j as no deadline', (raw) => {
    expect(validateExpiresAt(raw, now, 60)).toBeNull();
  });

  it('accepts exactly now + minimum and returns UTC ISO', () => {
    expect(validateExpiresAt('2026-09-25T13:00:00Z', now, 60)).toBe('2026-09-25T13:00:00.000Z');
    expect(validateExpiresAt('2026-09-25T10:05:00-03:00', now, 65)).toBe('2026-09-25T13:05:00.000Z');
  });

  it('rejects now + 59 minutes', () => {
    expect(() => validateExpiresAt('2026-09-25T12:59:00.000Z', now, 60)).toThrow(
      invalid({ field: 'expiresAt', reason: 'too_soon' }),
    );
  });

  it.each([
    '2026-12-01',
    '2026-12-01T10:00:00',
    'December 1, 2026',
    '2026-13-01T10:00:00Z',
    // 2027, so a rolled-over date would not fail as too_soon instead.
    '2027-02-29T10:00:00Z',
    '2027-02-30T10:00:00Z',
    '2027-04-31T23:59:00-03:00',
    '2027-06-31T10:00:00+14:00',
    '2027-01-00T10:00:00Z',
    '2027-01-32T10:00:00Z',
  ])(
    'rejects %s without an explicit time zone or with an impossible date',
    (raw) => {
      expect(() => validateExpiresAt(raw, now, 60)).toThrow(invalid({ field: 'expiresAt', reason: 'format' }));
    },
  );

  it('accepts a real leap day, an offset that crosses into the next month and the end of a day', () => {
    expect(validateExpiresAt('2028-02-29T10:00:00Z', now, 60)).toBe('2028-02-29T10:00:00.000Z');
    expect(validateExpiresAt('2027-02-28T23:00:00-03:00', now, 60)).toBe('2027-03-01T02:00:00.000Z');
    expect(validateExpiresAt('2027-01-10T24:00:00Z', now, 60)).toBe('2027-01-11T00:00:00.000Z');
  });

  it('checks only the format without a minimum', () => {
    expect(validateExpiresAt('2026-09-25T11:30:00Z', now, null)).toBe('2026-09-25T11:30:00.000Z');
    expect(() => validateExpiresAt('2026-02-30T10:00:00Z', now, null)).toThrow(
      invalid({ field: 'expiresAt', reason: 'format' }),
    );
  });

  it('rejects non-strings', () => {
    expect(() => validateExpiresAt(1_790_000_000_000, now, 60)).toThrow(
      invalid({ field: 'expiresAt', reason: 'type' }),
    );
  });
});
