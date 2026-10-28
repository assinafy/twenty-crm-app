import { describe, expect, it } from 'vitest';

import { CONTRACT_TERMS } from 'src/__tests__/fixtures/build-contract';
import { parseContractTerms } from 'src/utils/parse-contract-terms.util';

describe('parseContractTerms', () => {
  it('keeps calendar dates and exact cents without timezone conversion', () => {
    expect(parseContractTerms({ ...CONTRACT_TERMS, value: 0.29, start_date: '2028-02-29', end_date: '2028-02-29' }))
      .toMatchObject({ value: 0.29, start_date: '2028-02-29', end_date: '2028-02-29' });
  });

  it('allows cleared optional values and zero notice days', () => {
    expect(parseContractTerms({ status: 'draft', auto_renew: false, notice_period_days: 0 })).toEqual({
      status: 'draft', counterparty_name: null, value: null, currency: null, start_date: null,
      end_date: null, auto_renew: false, renewal_term_months: null, notice_period_days: 0,
    });
  });

  it.each([
    { start_date: '2027-02-29' }, { start_date: '2026-13-01' }, { start_date: '0999-01-01' },
    { start_date: '2027-10-01' }, { end_date: '2026-09-30' }, { end_date: '2027-09-30T00:00:00Z' },
    { auto_renew: 'true' }, { auto_renew: null }, { value: 1.001 }, { value: -1 },
    { value: Number.POSITIVE_INFINITY }, { value: 10_000_000_000_000 }, { currency: 'R$' },
    { status: 'terminated' }, { notice_period_days: 3651 }, { renewal_term_months: 0 },
    { renewal_term_months: 1.5 }, { counterparty_name: 'x'.repeat(256) },
  ])('rejects invalid contract terms %j', (patch) => {
    expect(() => parseContractTerms({ ...CONTRACT_TERMS, ...patch })).toThrow(expect.objectContaining({ code: 'INVALID_INPUT' }));
  });
});
