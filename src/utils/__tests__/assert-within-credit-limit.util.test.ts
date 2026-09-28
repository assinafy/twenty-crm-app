import { describe, expect, it } from 'vitest';

import { buildCostEstimate } from 'src/__tests__/fixtures/build-cost-estimate';
import { type CostEstimate } from 'src/types/cost-estimate';
import { assertWithinCreditLimit } from 'src/utils/assert-within-credit-limit.util';

const estimate = (overrides: Partial<CostEstimate> = {}): CostEstimate =>
  buildCostEstimate({ documents: 1, totalCredits: 0, creditBalance: 20, documentBalance: 5, ...overrides });

describe('assertWithinCreditLimit', () => {
  it('allows a plan-document-only send with maxCredits 0', () => {
    expect(() => assertWithinCreditLimit(estimate(), 0)).not.toThrow();
  });

  it('allows a cost equal to the limit despite floating point noise', () => {
    expect(() => assertWithinCreditLimit(estimate({ totalCredits: 0.45 * 13 }), 5.85)).not.toThrow();
  });

  it('throws COST_LIMIT_EXCEEDED above the limit', () => {
    const over = estimate({ totalCredits: 0.45 });
    expect(() => assertWithinCreditLimit(over, 0)).toThrow(
      expect.objectContaining({ code: 'COST_LIMIT_EXCEEDED', details: { estimate: over, maxCredits: 0 } }),
    );
  });

  it.each([
    [0.01, 0.009],
    [0.01, 0.005],
    [0.45, 0.449],
    [0.45, 0.445],
    [1, 0.995],
  ])('throws COST_LIMIT_EXCEEDED for %s against a sub-cent limit of %s', (totalCredits, maxCredits) => {
    expect(() => assertWithinCreditLimit(estimate({ totalCredits }), maxCredits)).toThrow(
      expect.objectContaining({ code: 'COST_LIMIT_EXCEEDED' }),
    );
  });

  it('allows a cost equal to a large limit', () => {
    expect(() => assertWithinCreditLimit(estimate({ totalCredits: 1234.56 }), 1234.56)).not.toThrow();
  });

  it('throws INSUFFICIENT_RESOURCES first', () => {
    expect(() =>
      assertWithinCreditLimit(estimate({ sufficient: false, blockingReason: 'PendingPayment' }), 100),
    ).toThrow(expect.objectContaining({ code: 'INSUFFICIENT_RESOURCES' }));
  });
});
