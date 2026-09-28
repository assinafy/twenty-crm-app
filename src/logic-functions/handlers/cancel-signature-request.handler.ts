import { selectDocumentCredential } from 'src/assinafy-client/select-document-credential';
import { DOCUMENT_STATUS } from 'src/constants/document-status';
import { assertCanUpdateAssinafyDocument } from 'src/data/assert-can-update-assinafy-document';
import { requireAssinafyDocument } from 'src/data/require-assinafy-document';
import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import { syncAssinafyDocument } from 'src/services/sync-assinafy-document.service';
import { type DocumentSummary } from 'src/types/document-summary';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { AppFailure } from 'src/utils/app-failure.util';
import { toAppError } from 'src/utils/to-app-error.util';
import { toDocumentSummary } from 'src/utils/to-document-summary.util';

// Deleting is Assinafy's only API cancellation.
export const cancelSignatureRequestHandler = async (
  input: { documentRecordId: string },
  ctx: MemberHandlerContext,
): Promise<DocumentSummary> => {
  const record = await requireAssinafyDocument(ctx.userCore, input.documentRecordId);

  const { assinafyDocumentId, assinafyAccountId } = record;
  if (record.status !== DOCUMENT_STATUS.PENDING_SIGNATURE || !assinafyDocumentId || !assinafyAccountId) {
    throw new AppFailure('INVALID_STATE', 'Só é possível cancelar documentos que estão aguardando assinaturas.');
  }

  await assertCanUpdateAssinafyDocument(ctx.userCore, record);

  const resolved = await selectDocumentCredential(ctx, assinafyAccountId);

  try {
    await resolved.client.documents.delete(assinafyDocumentId);
  } catch (error) {
    const failure = toAppError(error, 'mutation');

    // Assinafy refuses to delete a document that is still processing, already signed or created from a template.
    // The re-sync is best effort, so a failed one never hides the refusal.
    if (failure.code === 'PROVIDER_REJECTED') {
      const synced = await syncAssinafyDocument(ctx, record, resolved).catch(() => null);
      if (synced !== null && synced.status !== DOCUMENT_STATUS.PENDING_SIGNATURE) {
        throw new AppFailure('INVALID_STATE', 'O documento mudou na Assinafy e não pode mais ser cancelado.');
      }
      throw new AppFailure(
        'PROVIDER_REJECTED',
        record.templateName === null
          ? 'A Assinafy ainda não permite cancelar este documento. Se ele acabou de ser enviado, tente novamente em instantes.'
          : 'A Assinafy não permitiu cancelar este documento por aqui. Cancele-o na Assinafy.',
      );
    }
    // Already gone in Assinafy: the outcome the user asked for.
    if (failure.code !== 'NOT_FOUND') throw failure;
  }

  const now = ctx.now().toISOString();
  const updated = await updateAssinafyDocument(ctx.appCore, record.id, {
    status: DOCUMENT_STATUS.CANCELLED,
    completedAt: record.completedAt ?? now,
    lastSyncedAt: now,
    lastError: null,
  });

  return toDocumentSummary(updated);
};
