import { buildSignatureRequestInput } from 'src/front-components/utils/build-signature-request-input.util';
import { type SendFlowState } from 'src/types/send-flow-state';
import { type SendSignatureRequestInput } from 'src/types/send-signature-request-input';

// Body of /assinafy/send for the reviewed estimate. The request id is minted once per reviewed payload and reused by
// retries, so the server can answer a repeated send with the existing document instead of sending twice.
export const buildSendRequest = (
  state: Pick<SendFlowState, 'prepared' | 'draft' | 'context' | 'requestId'>,
  mintRequestId: () => string,
): SendSignatureRequestInput | null => {
  const { prepared } = state;

  if (prepared === null) {
    return null;
  }

  return {
    ...buildSignatureRequestInput(state.draft, state.context.record.id, prepared.assinafyDocumentId),
    requestId: state.requestId ?? mintRequestId(),
    accountId: prepared.accountId,
    expectedTotalCredits: prepared.estimate.totalCredits,
    expectedDocuments: prepared.estimate.documents,
  };
};
