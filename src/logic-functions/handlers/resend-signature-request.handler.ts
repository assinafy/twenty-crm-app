import { selectDocumentCredential } from 'src/assinafy-client/select-document-credential';
import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { assertCanUpdateAssinafyDocument } from 'src/data/assert-can-update-assinafy-document';
import { requireAssinafyDocument } from 'src/data/require-assinafy-document';
import { syncAssinafyDocument } from 'src/services/sync-assinafy-document.service';
import { type CostEstimate } from 'src/types/cost-estimate';
import { type DocumentSummary } from 'src/types/document-summary';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { type ResendInput } from 'src/types/resend-input';
import { AppFailure } from 'src/utils/app-failure.util';
import { assertEstimateUnchanged } from 'src/utils/assert-estimate-unchanged.util';
import { billable } from 'src/utils/billable.util';
import { normalizeCostEstimate } from 'src/utils/normalize-cost-estimate.util';
import { toAppError } from 'src/utils/to-app-error.util';
import { toDocumentSummary } from 'src/utils/to-document-summary.util';

// Without expectedTotalCredits it only quotes; with it, it resends once at exactly that (re-checked) cost.
export const resendSignatureRequestHandler = async (
  input: ResendInput,
  ctx: MemberHandlerContext,
): Promise<{ estimate: CostEstimate } | DocumentSummary> => {
  const record = await requireAssinafyDocument(ctx.userCore, input.documentRecordId);

  const { assinafyDocumentId, assinafyAssignmentId, assinafyAccountId } = record;
  const signer = record.signers?.find((candidate) => candidate.id === input.signerId);
  if (
    record.status !== DOCUMENT_STATUS.PENDING_SIGNATURE ||
    signer?.notified !== true ||
    signer.completed === true ||
    !assinafyDocumentId ||
    !assinafyAssignmentId ||
    !assinafyAccountId
  ) {
    throw new AppFailure('INVALID_STATE', 'Só é possível reenviar o convite a um signatário já convidado que ainda não assinou.');
  }

  // Checked before the quote too, so a member is never asked to confirm a price for a resend they cannot make.
  await assertCanUpdateAssinafyDocument(ctx.userCore, record);

  const resolved = await selectDocumentCredential(ctx, assinafyAccountId);
  const ids = [assinafyDocumentId, assinafyAssignmentId, input.signerId] as const;

  const fresh = normalizeCostEstimate(
    await resolved.client.assignments.estimateResendCost(...ids).catch((error: unknown) => {
      throw toAppError(error, 'read');
    }),
  );
  if (input.expectedTotalCredits === null) return { estimate: fresh };

  // A resend never charges a document, so only sufficiency and credits are compared.
  assertEstimateUnchanged(fresh, { totalCredits: input.expectedTotalCredits, documents: fresh.documents });

  // is_sent is read inside the billable call: a malformed answer is as uncertain as a timeout.
  const sent = await billable(async () => {
    const { is_sent: isSent } = await resolved.client.assignments.resendNotification(...ids);
    if (typeof isSent !== 'boolean') throw new TypeError('Unexpected resend response');
    return isSent;
  });
  if (!sent) throw new AppFailure('PROVIDER_REJECTED', 'A Assinafy não reenviou o convite.');

  // The notification went out: a failed refresh must not read as a failed resend the user would retry (and pay again).
  try {
    return toDocumentSummary(await syncAssinafyDocument(ctx, record, resolved));
  } catch (error) {
    console.warn('[assinafy] resend-signature-request: refresh after resend failed', {
      code: toAppError(error, 'read').code,
    });
    return toDocumentSummary(record);
  }
};
