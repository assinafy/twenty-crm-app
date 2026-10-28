import { type IDocumentContract } from '@assinafy/sdk';

import { type ContractTerms } from 'src/types/contract-terms';

export const CONTRACT_TERMS: ContractTerms = {
  status: 'active', counterparty_name: 'Empresa Exemplo', value: 1200.5, currency: 'BRL',
  start_date: '2026-10-01', end_date: '2027-09-30', auto_renew: false,
  renewal_term_months: 12, notice_period_days: 30,
};
export const CONTRACT_UPDATED_AT = '2026-10-28T12:00:00Z';
export const buildContract = (overrides: Partial<IDocumentContract> = {}): IDocumentContract => ({
  ...CONTRACT_TERMS, resource: 'document_contract', document_id: 'doc-1', term: 1,
  counterparty_taxpayer_id: '11144477735', owner_id: 'owner-1', metadata: { confidential: 'private' },
  external_references: [], created_at: CONTRACT_UPDATED_AT, updated_at: CONTRACT_UPDATED_AT,
  ...overrides,
});
