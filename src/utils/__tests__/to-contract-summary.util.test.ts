import { describe, expect, it } from 'vitest';

import { buildContract, CONTRACT_TERMS, CONTRACT_UPDATED_AT } from 'src/__tests__/fixtures/build-contract';
import { toContractSummary } from 'src/utils/to-contract-summary.util';

describe('toContractSummary', () => {
  it.each(['draft', 'active', 'expired', 'terminated'] as const)('returns only allowed fields for %s roots', (status) => {
    expect(toContractSummary(buildContract({ status }), 'doc-1')).toEqual({
      ...CONTRACT_TERMS, kind: 'contract', status, term: 1, updatedAt: CONTRACT_UPDATED_AT,
    });
  });

  it('does not expose parent links, terms, changes, tax IDs or unrelated document names for an amendment', () => {
    expect(toContractSummary({
      resource: 'document_contract_amendment', document_id: 'doc-1', status: 'pending',
      relation_type: 'amendment', updated_at: CONTRACT_UPDATED_AT, applied_at: null,
      parent_document_id: 'hidden-document', terms: { counterparty_taxpayer_id: '11144477735' },
    }, 'doc-1')).toEqual({ kind: 'amendment', status: 'pending', relationType: 'amendment', appliedAt: null, updatedAt: CONTRACT_UPDATED_AT });
  });

  it('reads applied instruments', () => {
    expect(toContractSummary({ resource: 'document_contract_amendment', document_id: 'doc-1', status: 'applied',
      relation_type: 'renewal', updated_at: CONTRACT_UPDATED_AT, applied_at: CONTRACT_UPDATED_AT }, 'doc-1'))
      .toMatchObject({ appliedAt: CONTRACT_UPDATED_AT });
  });

  it.each([
    null, { ...buildContract(), document_id: 'other' }, { ...buildContract(), resource: 'unknown' },
    { ...buildContract(), updated_at: 'not-a-date' }, { ...buildContract(), updated_at: '2026-99-99T12:00:00Z' },
    { ...buildContract(), term: 0 }, { ...buildContract(), status: 'unknown' },
  ])('fails closed for malformed responses', (input) => {
    expect(() => toContractSummary(input, 'doc-1')).toThrow(expect.objectContaining({ name: 'AppFailure' }));
  });
});
