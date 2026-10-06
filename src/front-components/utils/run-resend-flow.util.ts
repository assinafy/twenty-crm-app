import { NO_ENVELOPE_MESSAGE } from 'src/constants/app-route';
import { type AppResult } from 'src/types/app-result';
import { type CostEstimate } from 'src/types/cost-estimate';
import { type DocumentSummary } from 'src/types/document-summary';
import { type ResendInput } from 'src/types/resend-input';

// Quotes the resend first, asks for confirmation, then resends at exactly the quoted cost.
// Resolves null when the user declines.
export const runResendFlow = async ({
  documentRecordId,
  signerId,
  call,
  confirm,
}: {
  documentRecordId: string;
  signerId: string;
  call: (body: ResendInput) => Promise<AppResult<{ estimate: CostEstimate } | DocumentSummary>>;
  confirm: (estimate: CostEstimate) => Promise<boolean>;
}): Promise<AppResult<DocumentSummary> | null> => {
  const quote = await call({ documentRecordId, signerId, expectedTotalCredits: null });

  if (!quote.ok || !('estimate' in quote)) {
    return quote;
  }

  const { estimate } = quote;

  if (!estimate.sufficient) {
    return {
      ok: false,
      error: { code: 'INSUFFICIENT_RESOURCES', message: '', details: { blockingReason: estimate.blockingReason } },
    };
  }

  if (!(await confirm(estimate))) {
    return null;
  }

  const resent = await call({ documentRecordId, signerId, expectedTotalCredits: estimate.totalCredits });

  // An answer that never arrived or could not be read does not prove the resend failed: the member is told to check
  // Assinafy instead of trying again and paying twice. The route's own INTERNAL only comes from before the resend.
  if (!resent.ok && resent.error.code === 'INTERNAL' && resent.error.message === NO_ENVELOPE_MESSAGE) {
    return { ok: false, error: { code: 'UNCERTAIN', message: '' } };
  }

  // With an expected cost the route resends; a second quote means the contract was broken.
  return resent.ok && 'estimate' in resent
    ? { ok: false, error: { code: 'INTERNAL', message: 'Unexpected quote' } }
    : resent;
};
