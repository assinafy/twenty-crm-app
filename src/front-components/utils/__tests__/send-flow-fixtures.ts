import { buildCostEstimate } from 'src/__tests__/fixtures/build-cost-estimate';
import { createSendFlowState } from 'src/front-components/utils/create-send-flow-state.util';
import { type CostEstimate } from 'src/types/cost-estimate';
import { type DocumentSummary } from 'src/types/document-summary';
import { type PreparedSignatureRequest } from 'src/types/prepared-signature-request';
import { type SendFlowState } from 'src/types/send-flow-state';
import { type SignatureContext } from 'src/types/signature-context';

export const RECORD_ID = '0f0f0f0f-0000-4000-8000-000000000001';
export const CONTRACT_ID = '0a0a0a0a-0000-4000-8000-000000000001';
export const ANNEX_ID = '0a0a0a0a-0000-4000-8000-000000000002';

export const CONTEXT: SignatureContext = {
  record: { objectNameSingular: 'opportunity', id: RECORD_ID, name: 'Deal' },
  sendingAs: { kind: 'personal', accountId: 'account-1', accountName: 'Acme workspace' },
  backgroundSyncAvailable: true,
  templates: [
    {
      id: 'template-1',
      name: 'NDA',
      documentName: 'NDA document',
      signerRoles: [
        { id: 'role-client', name: 'Client' },
        { id: 'role-witness', name: 'Witness' },
      ],
      editorFields: [{ fieldId: 'field-price', label: 'Price' }],
      unsupportedReason: null,
    },
    {
      id: 'template-2',
      name: 'With copy receiver',
      documentName: null,
      signerRoles: [{ id: 'role-signer', name: 'Signer' }],
      editorFields: [],
      unsupportedReason: 'UNSUPPORTED_ROLES',
    },
  ],
  attachments: [
    { id: CONTRACT_ID, name: 'Contract.pdf' },
    { id: ANNEX_ID, name: 'Annex.PDF' },
  ],
  suggestedSigners: [{ personId: 'person-ana', name: 'Ana Lima', email: 'ana@example.invalid', phone: '+15550100001' }],
  additionalContacts: [{ personId: 'person-bruno', name: 'Bruno Reis', email: null, phone: '+15550100002' }],
  recentSends: [],
};

export const estimate = (overrides: Partial<CostEstimate> = {}): CostEstimate =>
  buildCostEstimate({ documents: 1, documentBalance: 5, ...overrides });

export const prepared = (overrides: Partial<PreparedSignatureRequest> = {}): PreparedSignatureRequest => ({
  accountId: 'account-1',
  accountName: 'Acme workspace',
  assinafyDocumentId: 'doc-1',
  estimate: estimate(),
  ...overrides,
});

export const summary = (overrides: Partial<DocumentSummary> = {}): DocumentSummary => ({
  documentRecordId: 'record-doc-1',
  status: 'PENDING_SIGNATURE',
  name: 'Contract',
  signerCount: 1,
  signedCount: 0,
  signers: [],
  declineReason: null,
  sentAt: '2026-09-25T12:00:00.000Z',
  completedAt: null,
  expiresAt: null,
  lastSyncedAt: '2026-09-25T12:00:00.000Z',
  lastError: null,
  ...overrides,
});

// A PDF flow for the contract with Ana, on the review step.
export const reviewState = (overrides: Partial<SendFlowState> = {}): SendFlowState => ({
  ...createSendFlowState({ ...CONTEXT, attachments: [{ id: CONTRACT_ID, name: 'Contract.pdf' }] }),
  step: 'REVIEW',
  prepared: prepared(),
  upload: {
    assinafyDocumentId: 'doc-1',
    accountId: 'account-1',
    attachmentId: CONTRACT_ID,
    name: 'Contract',
    sendAttempted: false,
  },
  ...overrides,
});
