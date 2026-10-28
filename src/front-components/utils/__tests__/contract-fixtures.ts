import { type ContractPanelState } from 'src/types/contract-panel-state';
import { type ContractSummary } from 'src/types/contract-summary';

export const contract = (overrides: Partial<Extract<ContractSummary, { kind: 'contract' }>> = {}): Extract<ContractSummary, { kind: 'contract' }> => ({
  kind: 'contract', status: 'active', counterparty_name: 'Empresa Exemplo', value: 1200.5, currency: 'BRL',
  start_date: '2026-11-01', end_date: '2027-10-31', auto_renew: false, renewal_term_months: 12,
  notice_period_days: 30, term: 1, updatedAt: '2026-10-28T12:00:00Z', ...overrides,
});

export const panelState = (overrides: Partial<ContractPanelState> = {}): ContractPanelState => ({
  contract: contract(), loaded: true, busy: false, refreshRequired: false, revision: 1, error: null, ...overrides,
});
