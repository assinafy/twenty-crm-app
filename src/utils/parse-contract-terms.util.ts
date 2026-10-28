import { type ContractTerms } from 'src/types/contract-terms';
import { expectObject } from 'src/utils/expect-object.util';
import { invalidInput } from 'src/utils/invalid-input.util';
import { readContractDate } from 'src/utils/read-contract-date.util';
import { readEnum } from 'src/utils/read-enum.util';
import { readNumber } from 'src/utils/read-number.util';
import { readString } from 'src/utils/read-string.util';

export const parseContractTerms = (body: unknown): ContractTerms => {
  const input = expectObject(body, 'terms', [
    'status', 'counterparty_name', 'value', 'currency', 'start_date', 'end_date',
    'auto_renew', 'renewal_term_months', 'notice_period_days',
  ]);
  const start = readContractDate(input.start_date, 'terms.start_date');
  const end = readContractDate(input.end_date, 'terms.end_date');
  if (start && end && end < start) throw invalidInput('terms.end_date', 'out_of_range');
  if (typeof input.auto_renew !== 'boolean') throw invalidInput('terms.auto_renew', 'type');
  const value = readNumber(input.value, 'terms.value', { min: 0, max: 9_999_999_999_999.99 });
  if (value !== null && Number(value.toFixed(2)) !== value) {
    throw invalidInput('terms.value', 'format');
  }
  return {
    status: readEnum(input.status, 'terms.status', ['draft', 'active'], { required: true }),
    counterparty_name: readString(input.counterparty_name, 'terms.counterparty_name', { max: 255 }),
    value,
    currency: readString(input.currency, 'terms.currency', { test: (currency) => /^[A-Z]{3}$/.test(currency) }),
    start_date: start,
    end_date: end,
    auto_renew: input.auto_renew,
    renewal_term_months: readNumber(input.renewal_term_months, 'terms.renewal_term_months', { min: 1, max: 600, integer: true }),
    notice_period_days: readNumber(input.notice_period_days, 'terms.notice_period_days', { min: 0, max: 3650, integer: true }),
  };
};
