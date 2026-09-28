import { type CostEstimate } from 'src/types/cost-estimate';
import { AppFailure } from 'src/utils/app-failure.util';

export const assertSufficientResources = (estimate: CostEstimate): void => {
  if (!estimate.sufficient) {
    throw new AppFailure(
      'INSUFFICIENT_RESOURCES',
      'O workspace da Assinafy não tem documentos ou créditos suficientes.',
      { blockingReason: estimate.blockingReason, estimate },
    );
  }
};
