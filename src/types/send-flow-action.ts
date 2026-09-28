import { type AppError } from 'src/types/app-error';
import { type DocumentSummary } from 'src/types/document-summary';
import { type NotificationMethod } from 'src/types/notification-method';
import { type PreparedSignatureRequest } from 'src/types/prepared-signature-request';
import { type VerificationMethod } from 'src/types/verification-method';

export type SendFlowAction =
  | { type: 'SET_SOURCE_TYPE'; sourceType: 'PDF' | 'TEMPLATE' }
  | { type: 'SET_ATTACHMENT'; attachmentId: string }
  | { type: 'SET_TEMPLATE'; templateId: string }
  | { type: 'SET_EDITOR_FIELD'; fieldId: string; value: string }
  | { type: 'SET_TEXT'; field: 'name' | 'message' | 'expiresOn'; value: string }
  | { type: 'TOGGLE_SEQUENTIAL' }
  | { type: 'SET_SIGNER_TEXT'; index: number; field: 'name' | 'email' | 'phone' | 'governmentId'; value: string }
  | { type: 'SET_VERIFICATION'; index: number; method: VerificationMethod }
  | { type: 'SET_NOTIFICATION'; index: number; method: NotificationMethod }
  | { type: 'FILL_SIGNER'; index: number; personId: string }
  | { type: 'ADD_SIGNER' }
  | { type: 'REMOVE_SIGNER'; index: number }
  | { type: 'GO_TO'; step: 'DOCUMENT' | 'SIGNERS' }
  | { type: 'SHOW_ERROR'; error: AppError }
  | { type: 'PREPARE_STARTED' }
  | { type: 'PREPARE_SUCCEEDED'; prepared: PreparedSignatureRequest }
  | { type: 'PREPARE_FAILED'; error: AppError }
  | { type: 'TOGGLE_CONFIRMED' }
  | { type: 'SEND_STARTED'; requestId: string }
  | { type: 'SEND_SUCCEEDED'; summary: DocumentSummary }
  | { type: 'SEND_FAILED'; error: AppError };
