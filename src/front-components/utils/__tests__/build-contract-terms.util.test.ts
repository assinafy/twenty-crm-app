import { describe, expect, it } from 'vitest';

import { contract } from 'src/front-components/utils/__tests__/contract-fixtures';
import { buildContractTerms } from 'src/front-components/utils/build-contract-terms.util';
import { toContractDraft } from 'src/front-components/utils/to-contract-draft.util';

describe('buildContractTerms', () => {
  it('normalizes entered terms through the shared contract validator', () => {
    expect(buildContractTerms({ ...toContractDraft(contract()), value: ' 1234,56 ', currency: ' brl ', counterparty_name: ' Empresa Exemplo ' })).toMatchObject({
      ok: true, terms: { value: 1234.56, currency: 'BRL', counterparty_name: 'Empresa Exemplo', renewal_term_months: 12, notice_period_days: 30 },
    });
  });

  it('clears optional blank values while preserving zero', () => {
    expect(buildContractTerms(toContractDraft(null))).toEqual({
      ok: true,
      terms: { status: 'draft', counterparty_name: null, value: null, currency: 'BRL', start_date: null, end_date: null, auto_renew: false, renewal_term_months: null, notice_period_days: null },
    });
    expect(buildContractTerms({ ...toContractDraft(null), value: '0', notice_period_days: '0' })).toMatchObject({
      ok: true, terms: { value: 0, notice_period_days: 0 },
    });
    expect(buildContractTerms({ ...toContractDraft(null), value: '10.50' })).toMatchObject({ ok: true, terms: { value: 10.5 } });
  });

  it('preserves an existing null currency when changing another term', () => {
    expect(buildContractTerms({ ...toContractDraft(contract({ currency: null })), notice_period_days: '15' })).toMatchObject({
      ok: true, terms: { currency: null, notice_period_days: 15 },
    });
  });

  it.each(['1.000,50', '0x10', '1e3', '-1', 'Infinity', '1,234'])('refuses an ambiguous or invalid amount %s', (value) => {
    expect(buildContractTerms({ ...toContractDraft(null), value })).toMatchObject({
      ok: false, error: { code: 'INVALID_INPUT', details: { field: 'terms.value' } },
    });
  });

  it.each([
    ['renewal_term_months', '1,5'],
    ['notice_period_days', '3651'],
    ['start_date', '2027-02-30'],
    ['end_date', '2026-01-01'],
    ['currency', 'REAL'],
  ] as const)('shares server validation for %s', (field, value) => {
    expect(buildContractTerms({ ...toContractDraft(contract()), [field]: value })).toMatchObject({
      ok: false, error: { code: 'INVALID_INPUT', details: { field: `terms.${field}` } },
    });
  });

  it('rethrows an unexpected failure for the action runner', () => {
    const draft = toContractDraft(null);
    Object.defineProperty(draft, 'value', { get: () => { throw new TypeError('unexpected'); } });
    expect(() => buildContractTerms(draft)).toThrow('unexpected');
  });
});
