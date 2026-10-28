import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import { readAssinafyContract } from 'src/services/read-assinafy-contract.service';
import { storeContractSummary } from 'src/services/store-contract-summary.service';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type ContractSummary } from 'src/types/contract-summary';
import { type HandlerContext } from 'src/types/handler-context';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { AppFailure } from 'src/utils/app-failure.util';
import { toAppError } from 'src/utils/to-app-error.util';

export const syncAssinafyContract = async (
  ctx: HandlerContext,
  record: AssinafyDocumentRecord,
  resolved: ResolvedCredential,
): Promise<ContractSummary | null> => {
  if (!record.assinafyDocumentId || record.assinafyAccountId !== resolved.accountId) {
    throw new AppFailure('INVALID_STATE', 'O contrato não pertence ao workspace conectado.');
  }
  try {
    const contract = await readAssinafyContract(resolved.client, record.assinafyDocumentId);
    await storeContractSummary(ctx, record.id, contract);
    return contract;
  } catch (error) {
    // Rotate a failing contract without changing its last known terms or signature state.
    await updateAssinafyDocument(ctx.appCore, record.id, { contractSyncedAt: ctx.now().toISOString() }).catch(() => undefined);
    throw toAppError(error, 'read');
  }
};
