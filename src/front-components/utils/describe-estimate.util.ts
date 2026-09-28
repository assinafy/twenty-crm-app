import { msg } from 'twenty-sdk/front-component';

import { formatCredits } from 'src/front-components/utils/format-credits.util';
import { getErrorMessage } from 'src/front-components/utils/get-error-message.util';
import { type CostEstimate } from 'src/types/cost-estimate';
import { type LocalizedMessage } from 'src/types/localized-message';

// Review lines for an estimate: the documents it consumes, its credits, the balance and what blocks sending. Numbers
// follow a label, so the wording never depends on singular or plural.
export const describeEstimate = (
  estimate: CostEstimate,
): {
  total: LocalizedMessage;
  documents: LocalizedMessage;
  balance: LocalizedMessage | null;
  blocking: LocalizedMessage | null;
  confirmation: LocalizedMessage;
} => {
  const credits = formatCredits(estimate.totalCredits);
  const documents = formatCredits(estimate.documents);

  return {
    total: { message: msg('Total em créditos: {credits}'), values: { credits } },
    documents: estimate.needsExtraDocument
      ? {
          message: msg(
            'Os documentos do plano do workspace da Assinafy acabaram, então esta solicitação usa um documento adicional, incluído no total (custo em créditos: {cost}).',
          ),
          values: { cost: formatCredits(estimate.extraDocumentCost) },
        }
      : { message: msg('Documentos do plano usados: {documents}'), values: { documents } },
    balance:
      estimate.creditBalance === null && estimate.documentBalance === null
        ? null
        : {
            message: msg('Saldo em créditos: {credits} · Documentos disponíveis no plano: {documents}'),
            values: {
              credits: estimate.creditBalance === null ? '—' : formatCredits(estimate.creditBalance),
              documents: estimate.documentBalance === null ? '—' : formatCredits(estimate.documentBalance),
            },
          },
    blocking: estimate.sufficient
      ? null
      : getErrorMessage({ code: 'INSUFFICIENT_RESOURCES', details: { blockingReason: estimate.blockingReason } }),
    confirmation: estimate.needsExtraDocument
      ? {
          message: msg('Confirmo o custo desta solicitação, que inclui um documento adicional. Total em créditos: {credits}.'),
          values: { credits },
        }
      : {
          message: msg(
            'Confirmo o custo desta solicitação. Documentos do plano: {documents} · Total em créditos: {credits}.',
          ),
          values: { documents, credits },
        },
  };
};
