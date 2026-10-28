import { updateAssinafyDocument } from 'src/data/update-assinafy-document';
import { type ContractStatus } from 'src/types/contract-status';
import { type ContractSummary } from 'src/types/contract-summary';
import { type HandlerContext } from 'src/types/handler-context';

const STATUS: Record<ContractSummary['status'], ContractStatus> = {
  draft: 'DRAFT', active: 'ACTIVE', expired: 'EXPIRED', terminated: 'TERMINATED',
  pending: 'AMENDMENT_PENDING', applied: 'AMENDMENT_APPLIED',
};

export const storeContractSummary = async (
  ctx: Pick<HandlerContext, 'appCore' | 'now'>,
  recordId: string,
  contract: ContractSummary | null,
): Promise<void> => {
  await updateAssinafyDocument(ctx.appCore, recordId, {
    contractStatus: contract === null ? null : STATUS[contract.status],
    contractDetails: contract,
    contractSyncedAt: ctx.now().toISOString(),
  });
};
