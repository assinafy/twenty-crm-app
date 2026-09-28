import { type CostEstimate } from 'src/types/cost-estimate';
import { AppFailure } from 'src/utils/app-failure.util';
import { assertSufficientResources } from 'src/utils/assert-sufficient-resources.util';
import { toCents } from 'src/utils/to-cents.util';

export const assertEstimateUnchanged = (
  fresh: CostEstimate,
  expected: { totalCredits: number; documents: number },
): void => {
  assertSufficientResources(fresh);
  if (toCents(fresh.totalCredits) !== toCents(expected.totalCredits) || fresh.documents !== expected.documents) {
    throw new AppFailure('COST_CHANGED', 'O custo na Assinafy mudou. Revise-o novamente.', { estimate: fresh });
  }
};
