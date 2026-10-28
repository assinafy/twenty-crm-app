import { type ContractSummary } from 'src/types/contract-summary';
import { AppFailure } from 'src/utils/app-failure.util';
import { expectObject } from 'src/utils/expect-object.util';
import { parseContractTerms } from 'src/utils/parse-contract-terms.util';
import { readEnum } from 'src/utils/read-enum.util';
import { readNumber } from 'src/utils/read-number.util';
import { readString } from 'src/utils/read-string.util';

// Return only the current document's terms; tax IDs, metadata and other documents never reach the member route.
export const toContractSummary = (value: unknown, documentId: string): ContractSummary => {
  const input = expectObject(value, 'contract');
  if (input.document_id !== documentId) throw new AppFailure('INTERNAL', 'Resposta de contrato inválida.');
  const updatedAt = readString(input.updated_at, 'updatedAt', {
    required: true,
    max: 40,
    test: (date) => /^\d{4}-\d{2}-\d{2}T/.test(date) && Number.isFinite(Date.parse(date)),
  });
  if (input.resource === 'document_contract_amendment') {
    return {
      kind: 'amendment',
      status: readEnum(input.status, 'status', ['pending', 'applied'], { required: true }),
      relationType: readEnum(input.relation_type, 'relationType', ['amendment', 'renewal', 'termination'], { required: true }),
      appliedAt: readString(input.applied_at, 'appliedAt', { test: (date) => Number.isFinite(Date.parse(date)) }),
      updatedAt,
    };
  }
  if (input.resource !== 'document_contract') throw new AppFailure('INTERNAL', 'Resposta de contrato inválida.');
  const status = readEnum(input.status, 'status', ['draft', 'active', 'expired', 'terminated'], { required: true });
  const terms = parseContractTerms({
    status: status === 'draft' ? 'draft' : 'active',
    counterparty_name: input.counterparty_name,
    value: input.value,
    currency: input.currency,
    start_date: input.start_date,
    end_date: input.end_date,
    auto_renew: input.auto_renew,
    renewal_term_months: input.renewal_term_months,
    notice_period_days: input.notice_period_days,
  });
  return {
    ...terms,
    kind: 'contract',
    status,
    term: readNumber(input.term, 'term', { min: 1, max: Number.MAX_SAFE_INTEGER, integer: true, required: true }),
    updatedAt,
  };
};
