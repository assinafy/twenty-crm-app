import { describe, expect, it } from 'vitest';

import { formatDate } from 'src/utils/format-date.util';

describe('formatDate', () => {
  it('formats an ISO date in pt-BR', () => {
    const iso = '2026-09-25T15:30:00.000Z';

    expect(formatDate(iso)).toBe(
      new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso)),
    );
    expect(formatDate(iso)).toMatch(/set\.? de 2026/);
  });

  it('formats in the given time zone', () => {
    expect(formatDate('2026-10-01T00:00:00.000Z', 'America/Sao_Paulo')).toBe('30 de set. de 2026, 21:00');
  });

  it.each([null, 'not a date'])('returns null for %j', (iso) => {
    expect(formatDate(iso)).toBeNull();
  });
});
