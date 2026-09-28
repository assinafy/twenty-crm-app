import { type CostEstimate } from 'src/types/cost-estimate';
import { AppFailure } from 'src/utils/app-failure.util';
import { assertSufficientResources } from 'src/utils/assert-sufficient-resources.util';
import { toCents } from 'src/utils/to-cents.util';

// maxCredits 0 still allows a send that only consumes a plan document. The limit is rounded down to whole cents (the
// tolerance absorbs float noise such as 5.85 * 100 = 584.99...), so a sub-cent limit never loosens the cap.
export const assertWithinCreditLimit = (estimate: CostEstimate, maxCredits: number): void => {
  assertSufficientResources(estimate);
  if (toCents(estimate.totalCredits) > Math.floor(maxCredits * 100 + 1e-6)) {
    throw new AppFailure('COST_LIMIT_EXCEEDED', 'O custo na Assinafy ultrapassa o limite de créditos permitido.', {
      estimate,
      maxCredits,
    });
  }
};
