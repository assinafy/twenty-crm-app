import { type openCommandConfirmationModal, type useTranslate } from 'twenty-sdk/front-component';

import { formatCredits } from 'src/front-components/utils/format-credits.util';
import { type CostEstimate } from 'src/types/cost-estimate';

// A paid, non-destructive confirmation: the host draws a missing accent as danger.
export const confirmResend = async ({
  estimate,
  t,
  open,
}: {
  estimate: CostEstimate;
  t: ReturnType<typeof useTranslate>['t'];
  open: typeof openCommandConfirmationModal;
}): Promise<boolean> =>
  (await open({
    title: t('Reenviar o convite?'),
    subtitle: t('Custo do reenvio em créditos do workspace da Assinafy: {credits}.', {
      credits: formatCredits(estimate.totalCredits),
    }),
    confirmButtonText: t('Reenviar'),
    confirmButtonAccent: 'blue',
  })) === 'confirm';
