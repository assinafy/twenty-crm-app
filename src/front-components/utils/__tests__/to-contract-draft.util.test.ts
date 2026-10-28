import { describe, expect, it } from 'vitest';

import { contract } from 'src/front-components/utils/__tests__/contract-fixtures';
import { toContractDraft } from 'src/front-components/utils/to-contract-draft.util';

describe('toContractDraft', () => {
  it('starts a draft in BRL without inventing dates, values or renewal terms', () => {
    expect(toContractDraft(null)).toEqual({
      status: 'draft', counterparty_name: '', value: '', currency: 'BRL', start_date: '', end_date: '',
      auto_renew: false, renewal_term_months: '', notice_period_days: '',
    });
  });

  it('preserves the terms and renders decimals with the Brazilian separator', () => {
    expect(toContractDraft(contract({ auto_renew: true }))).toEqual({
      status: 'active', counterparty_name: 'Empresa Exemplo', value: '1200,5', currency: 'BRL',
      start_date: '2026-11-01', end_date: '2027-10-31', auto_renew: true, renewal_term_months: '12', notice_period_days: '30',
    });
    expect(toContractDraft(contract({ value: 0, notice_period_days: 0, currency: null }))).toMatchObject({
      value: '0', notice_period_days: '0', currency: '',
    });
  });
});
