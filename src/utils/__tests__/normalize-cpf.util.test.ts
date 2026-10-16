import { describe, expect, it } from 'vitest';

import { normalizeCpf } from 'src/utils/normalize-cpf.util';

describe('normalizeCpf', () => {
  it.each(['529.982.247-25', ' 52998224725 '])('normalizes %s', (raw) => {
    expect(normalizeCpf(raw)).toBe('52998224725');
  });

  it.each(['', 'abc', '11111111111', '00000000000', '52998224715', '52998224724', '12ABC34501DE35', '00000000000191'])(
    'rejects %s', (raw) => expect(normalizeCpf(raw)).toBeNull(),
  );
});
