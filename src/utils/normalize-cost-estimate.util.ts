import { type CostEstimate } from 'src/types/cost-estimate';
import { AppFailure } from 'src/utils/app-failure.util';

const BLOCKING_REASONS = ['PendingPayment', 'InsufficientDocuments', 'InsufficientCredits'] as const;

const toNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const unexpectedEstimate = (): AppFailure =>
  new AppFailure('INTERNAL', 'A Assinafy retornou uma estimativa de custo inesperada.');

// The amounts gate billable calls, so a missing or malformed one fails closed instead of reading as free.
const requireNumber = (value: unknown): number => {
  const number = toNumber(value);
  if (number === null) {
    throw unexpectedEstimate();
  }
  return number;
};

// Accepts ICostEstimate and the legacy resend shape { total, credit_balance, has_sufficient_credits }.
// The sufficiency flag and the amounts are required: without them the estimate cannot gate a billable call.
export const normalizeCostEstimate = (raw: unknown): CostEstimate => {
  const estimate: Record<string, unknown> = typeof raw === 'object' && raw !== null ? { ...raw } : {};

  if (typeof estimate.has_sufficient_resources === 'boolean') {
    return {
      documents: requireNumber(estimate.documents),
      totalCredits: requireNumber(estimate.total_credits),
      creditBalance: toNumber(estimate.credit_balance),
      documentBalance: toNumber(estimate.document_balance),
      needsExtraDocument: estimate.needs_extra_document === true,
      extraDocumentCost: toNumber(estimate.extra_document_cost) ?? 0,
      sufficient: estimate.has_sufficient_resources,
      blockingReason: BLOCKING_REASONS.find((reason) => reason === estimate.blocking_reason) ?? null,
    };
  }

  if (typeof estimate.has_sufficient_credits === 'boolean') {
    return {
      documents: 0,
      totalCredits: requireNumber(estimate.total),
      creditBalance: toNumber(estimate.credit_balance),
      documentBalance: null,
      needsExtraDocument: false,
      extraDocumentCost: 0,
      sufficient: estimate.has_sufficient_credits,
      blockingReason: estimate.has_sufficient_credits ? null : 'InsufficientCredits',
    };
  }

  throw unexpectedEstimate();
};
