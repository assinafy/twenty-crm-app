import { type SendFlowState } from 'src/types/send-flow-state';

// The uploaded PDF carries the name typed at upload time, so a new name or attachment needs a new upload.
export const getReusableUploadId = ({ upload, draft }: Pick<SendFlowState, 'upload' | 'draft'>): string | null =>
  upload !== null &&
  draft.sourceType === 'PDF' &&
  upload.attachmentId === draft.attachmentId &&
  upload.name === draft.name.trim()
    ? upload.assinafyDocumentId
    : null;
