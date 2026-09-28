import { buildSignatureRequestInput } from 'src/front-components/utils/build-signature-request-input.util';
import { getReusableUploadId } from 'src/front-components/utils/get-reusable-upload-id.util';
import { type DiscardInput } from 'src/types/discard-input';
import { type SendFlowState } from 'src/types/send-flow-state';
import { type SignatureRequestInput } from 'src/types/signature-request-input';

// Body of /assinafy/prepare, plus the previous upload to discard when it can no longer be reused. An upload a send was
// attempted with is never discarded: Assinafy may have assigned it, and deleting it would cancel the request.
export const getPrepareRequest = (
  state: Pick<SendFlowState, 'upload' | 'draft' | 'context'>,
): { body: SignatureRequestInput; discard: DiscardInput | null } => {
  const reusableUploadId = getReusableUploadId(state);
  const { upload } = state;

  return {
    body: buildSignatureRequestInput(state.draft, state.context.record.id, reusableUploadId),
    discard:
      upload !== null && reusableUploadId === null && !upload.sendAttempted
        ? { assinafyDocumentId: upload.assinafyDocumentId, accountId: upload.accountId }
        : null,
  };
};
