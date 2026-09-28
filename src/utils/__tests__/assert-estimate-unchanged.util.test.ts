import { describe, expect, it } from 'vitest';

import { buildCostEstimate } from 'src/__tests__/fixtures/build-cost-estimate';
import { type CostEstimate } from 'src/types/cost-estimate';
import { assertEstimateUnchanged } from 'src/utils/assert-estimate-unchanged.util';

const estimate = (overrides: Partial<CostEstimate> = {}): CostEstimate =>
  buildCostEstimate({ documents: 1, totalCredits: 0.45 * 13, creditBalance: 20, documentBalance: 5, ...overrides });

describe('assertEstimateUnchanged', () => {
  it('accepts the same cost despite floating point noise', () => {
    expect(() => assertEstimateUnchanged(estimate(), { totalCredits: 5.85, documents: 1 })).not.toThrow();
  });

  it('throws COST_CHANGED when the credits differ by a cent', () => {
    const fresh = estimate();
    expect(() => assertEstimateUnchanged(fresh, { totalCredits: 5.84, documents: 1 })).toThrow(
      expect.objectContaining({ code: 'COST_CHANGED', details: { estimate: fresh } }),
    );
  });

  it('throws COST_CHANGED when the documents differ', () => {
    expect(() => assertEstimateUnchanged(estimate({ documents: 0 }), { totalCredits: 5.85, documents: 1 })).toThrow(
      expect.objectContaining({ code: 'COST_CHANGED' }),
    );
  });

  it('reports insufficient resources before comparing', () => {
    const fresh = estimate({ sufficient: false, blockingReason: 'InsufficientCredits' });
    expect(() => assertEstimateUnchanged(fresh, { totalCredits: 99, documents: 9 })).toThrow(
      expect.objectContaining({
        code: 'INSUFFICIENT_RESOURCES',
        details: { blockingReason: 'InsufficientCredits', estimate: fresh },
      }),
    );
  });
});
