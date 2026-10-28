import { type ContractDraft } from 'src/types/contract-draft';
import { type ContractSummary } from 'src/types/contract-summary';

export const toContractDraft = (contract: Extract<ContractSummary, { kind: 'contract' }> | null): ContractDraft => ({
  status: contract?.status === 'active' ? 'active' : 'draft',
  counterparty_name: contract?.counterparty_name ?? '',
  value: contract?.value?.toString().replace('.', ',') ?? '',
  currency: contract ? (contract.currency ?? '') : 'BRL',
  start_date: contract?.start_date ?? '',
  end_date: contract?.end_date ?? '',
  auto_renew: contract?.auto_renew ?? false,
  renewal_term_months: contract?.renewal_term_months?.toString() ?? '',
  notice_period_days: contract?.notice_period_days?.toString() ?? '',
});
