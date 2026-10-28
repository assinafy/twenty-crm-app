import { ApiError } from '@assinafy/sdk';

import { selectDocumentCredential } from 'src/assinafy-client/select-document-credential';
import { assertCanUpdateAssinafyDocument } from 'src/data/assert-can-update-assinafy-document';
import { requireAssinafyDocument } from 'src/data/require-assinafy-document';
import { readAssinafyContract } from 'src/services/read-assinafy-contract.service';
import { storeContractSummary } from 'src/services/store-contract-summary.service';
import { type ContractInput } from 'src/types/contract-input';
import { type ContractSummary } from 'src/types/contract-summary';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { AppFailure } from 'src/utils/app-failure.util';
import { errorName } from 'src/utils/error-name.util';
import { toAppError } from 'src/utils/to-app-error.util';
import { toContractSummary } from 'src/utils/to-contract-summary.util';

export const manageContractHandler = async (
  input: ContractInput,
  ctx: MemberHandlerContext,
): Promise<{ contract: ContractSummary | null }> => {
  const record = await requireAssinafyDocument(ctx.userCore, input.documentRecordId);
  const { assinafyDocumentId, assinafyAccountId } = record;
  if (!assinafyDocumentId || !assinafyAccountId || !record.sentAt) {
    throw new AppFailure('INVALID_STATE', 'O documento precisa ter um envio confirmado para gerenciar o contrato.');
  }
  if (input.action !== 'get') await assertCanUpdateAssinafyDocument(ctx.userCore, record);
  const resolved = await selectDocumentCredential(ctx, assinafyAccountId);
  const client = ctx.createAssinafyClient(resolved.credential, { accountId: assinafyAccountId, maxRetries: 0 });
  const remember = async (contract: ContractSummary | null) => {
    // A confirmed provider write remains successful even if its local mirror needs a later sync.
    await storeContractSummary(ctx, record.id, contract).catch((error: unknown) => {
      console.warn('[assinafy] manage-contract: mirror failed', { code: toAppError(error, 'read').code, name: errorName(error) });
    });
    return { contract };
  };
  let mutationStarted = false;
  try {
    const current = await readAssinafyContract(client, assinafyDocumentId);
    if (input.action === 'get') return remember(current);
    if (current?.kind === 'amendment') {
      throw new AppFailure('INVALID_STATE', 'Gerencie os aditivos e seus vínculos na Assinafy.');
    }
    if ((current?.updatedAt ?? null) !== input.updatedAt) {
      throw new AppFailure('CONTRACT_CHANGED', 'O contrato mudou. Atualize antes de continuar.');
    }
    if (input.action === 'set') {
      if (current && !['draft', 'active'].includes(current.status)) {
        throw new AppFailure('INVALID_STATE', 'Renove o contrato encerrado antes de alterar seus termos.');
      }
      if (current?.status === 'active' && input.terms.status === 'draft') {
        throw new AppFailure('INVALID_STATE', 'Um contrato vigente não pode voltar a rascunho.');
      }
      mutationStarted = true;
      const contract = await client.contracts.set(assinafyDocumentId, {
        ...input.terms,
        ...(input.updatedAt === null ? {} : { updated_at: input.updatedAt }),
      });
      return remember(toContractSummary(contract, assinafyDocumentId));
    }
    if (!current || current.status === 'terminated') {
      throw new AppFailure('INVALID_STATE', 'Este contrato não permite esta ação.');
    }
    if (input.action === 'renew') {
      if (!current.end_date || !['active', 'expired'].includes(current.status) || current.term !== input.term) {
        throw new AppFailure('CONTRACT_CHANGED', 'Confira o prazo e o período atual do contrato antes de renovar.');
      }
      mutationStarted = true;
      const contract = await client.contracts.renew(assinafyDocumentId, { term: input.term, updated_at: input.updatedAt });
      return remember(toContractSummary(contract, assinafyDocumentId));
    }
    mutationStarted = true;
    const contract = await client.contracts.terminate(assinafyDocumentId, { reason: input.reason, updated_at: input.updatedAt });
    return remember(toContractSummary(contract, assinafyDocumentId));
  } catch (error) {
    if (error instanceof ApiError && error.statusCode === 409) {
      throw new AppFailure('CONTRACT_CHANGED', 'O contrato mudou. Atualize antes de continuar.');
    }
    if (error instanceof ApiError && error.statusCode === 403 && error.challenge?.error !== 'insufficient_scope') {
      throw new AppFailure('CONTRACT_UNAVAILABLE', 'Confira a permissão e o plano de gestão de contratos na Assinafy.');
    }
    const failure = toAppError(error, mutationStarted ? 'billable' : 'read');
    if (mutationStarted && (failure.code === 'UNCERTAIN' || error instanceof AppFailure && ['INVALID_INPUT', 'INTERNAL'].includes(failure.code))) {
      throw new AppFailure('CONTRACT_UNCERTAIN', 'A Assinafy não confirmou a alteração. Atualize o contrato antes de continuar.');
    }
    throw failure;
  }
};
