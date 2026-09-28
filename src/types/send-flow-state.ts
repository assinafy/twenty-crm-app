import { type AppError } from 'src/types/app-error';
import { type DocumentSummary } from 'src/types/document-summary';
import { type PreparedSignatureRequest } from 'src/types/prepared-signature-request';
import { type SendFlowDraft } from 'src/types/send-flow-draft';
import { type SignatureContext } from 'src/types/signature-context';

export type SendFlowState = {
  step: 'DOCUMENT' | 'SIGNERS' | 'REVIEW' | 'SENDING' | 'DONE' | 'ERROR';
  context: SignatureContext;
  draft: SendFlowDraft;
  // A prepare request is in flight; the draft is locked meanwhile.
  preparing: boolean;
  error: AppError | null;
  prepared: PreparedSignatureRequest | null;
  confirmed: boolean;
  // Idempotency key of the reviewed payload; kept while a send outcome is unknown so a retry never sends twice.
  requestId: string | null;
  // PDF uploaded by the last prepare, reused while its attachment and name are unchanged. Once a send was attempted
  // with it, it is never discarded from the browser: Assinafy may have assigned it.
  upload: {
    assinafyDocumentId: string;
    accountId: string;
    attachmentId: string;
    name: string;
    sendAttempted: boolean;
  } | null;
  result: DocumentSummary | null;
};
