import { type AppResult } from 'src/types/app-result';
import { type ContractDraft } from 'src/types/contract-draft';
import { type ContractTerms } from 'src/types/contract-terms';
import { AppFailure } from 'src/utils/app-failure.util';
import { invalidInput } from 'src/utils/invalid-input.util';
import { parseContractTerms } from 'src/utils/parse-contract-terms.util';

const numeric = (text: string, field: string): number | null => {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  if (!/^\d+(?:[.,]\d+)?$/.test(trimmed)) throw invalidInput(field, 'format');
  return Number(trimmed.replace(',', '.'));
};

export const buildContractTerms = (draft: ContractDraft): AppResult<{ terms: ContractTerms }> => {
  try {
    return {
      ok: true,
      terms: parseContractTerms({
        ...draft,
        value: numeric(draft.value, 'terms.value'),
        currency: draft.currency.trim().toUpperCase(),
        renewal_term_months: numeric(draft.renewal_term_months, 'terms.renewal_term_months'),
        notice_period_days: numeric(draft.notice_period_days, 'terms.notice_period_days'),
      }),
    };
  } catch (error) {
    if (error instanceof AppFailure) {
      return { ok: false, error: { code: error.code, message: error.message, details: error.details } };
    }
    throw error;
  }
};
