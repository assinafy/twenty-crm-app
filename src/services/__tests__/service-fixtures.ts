import {
  type AssinafyClient,
  type IAssignment,
  type ICostEstimate,
  type IDocumentDetailsResponse,
  type ITemplateListItem,
} from '@assinafy/sdk';
import { vi } from 'vitest';

import { NOW } from 'src/__tests__/fixtures/build-context';
import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { buildSignerInput } from 'src/__tests__/fixtures/build-signer-input';
import { LEAK_SENTINELS } from 'src/__tests__/setup/unit-test-setup';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type CrmRecord } from 'src/types/crm-record';
import { type PendingUpload } from 'src/types/pending-upload';
import { type ResolvedCredential } from 'src/types/resolved-credential';
import { type SendSignatureRequestInput } from 'src/types/send-signature-request-input';
import { type SignatureRequestInput } from 'src/types/signature-request-input';

export const RECORD_ID = '5a1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d';
export const ATTACHMENT_ID = '6b2e3d4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
export const REQUEST_ID = '7c3f4e5a-6b7c-4d8e-9f0a-1b2c3d4e5f6a';

// Hand-written AssinafyClient double: every method the services call, as a vi.fn.
export const fakeAssinafyClient = () => {
  const documents = {
    details: vi.fn<(id: string) => Promise<IDocumentDetailsResponse>>(),
    upload: vi.fn<(source: { buffer: Buffer; fileName: string }, options: { name?: string }) => Promise<{ id: string }>>(),
    download: vi.fn<(id: string, artifact: string) => Promise<Buffer>>(),
    delete: vi.fn<(id: string) => Promise<void>>(),
    estimateCostFromTemplate: vi.fn<(templateId: string, signers: unknown[]) => Promise<ICostEstimate>>(),
    createFromTemplate: vi.fn<(templateId: string, signers: unknown[], options: object) => Promise<IDocumentDetailsResponse>>(),
  };
  const assignments = {
    estimateCost: vi.fn<(documentId: string, payload: object) => Promise<ICostEstimate>>(),
    create: vi.fn<(documentId: string, payload: object) => Promise<IAssignment>>(),
  };
  const signers = {
    create: vi.fn<(payload: object) => Promise<{ id: string; full_name: string; email: string | null; whatsapp_phone_number?: string | null }>>(),
    update: vi.fn<(id: string, patch: object) => Promise<unknown>>(),
  };
  const templates = {
    list: vi.fn<(params: object) => Promise<{ data: ITemplateListItem[] }>>(),
  };

  return {
    client: { documents, assignments, signers, templates } as unknown as AssinafyClient,
    documents,
    assignments,
    signers,
    templates,
  };
};

export const resolvedCredential = (client: AssinafyClient, overrides: Partial<ResolvedCredential> = {}): ResolvedCredential => ({
  credential: { kind: 'personal', connectionId: 'connection-1', accessToken: LEAK_SENTINELS[0], scopes: [] },
  accountId: 'account-1',
  accountName: 'Acme workspace',
  client,
  ...overrides,
});

export const crmRecord = (overrides: Partial<CrmRecord> = {}): CrmRecord => ({
  objectNameSingular: 'person',
  id: RECORD_ID,
  name: 'Ana Souza',
  primaryContactPersonId: RECORD_ID,
  companyId: null,
  ...overrides,
});

export const pdfInput = (overrides: Partial<SignatureRequestInput> = {}): SignatureRequestInput => ({
  recordId: RECORD_ID,
  source: { type: 'PDF', attachmentId: ATTACHMENT_ID },
  name: 'Service agreement',
  signers: [buildSignerInput()],
  message: null,
  expiresAt: null,
  sequential: false,
  assinafyDocumentId: null,
  ...overrides,
});

export const templateInput = (overrides: Partial<SignatureRequestInput> = {}): SignatureRequestInput => ({
  ...pdfInput(),
  source: { type: 'TEMPLATE', templateId: 'template-1', editorFields: [{ fieldId: 'field-price', value: '100' }] },
  signers: [buildSignerInput({ roleId: 'role-client' })],
  ...overrides,
});

export const sendInput = (
  request: SignatureRequestInput,
  overrides: Partial<SendSignatureRequestInput> = {},
): SendSignatureRequestInput => ({
  ...request,
  requestId: REQUEST_ID,
  accountId: 'account-1',
  expectedTotalCredits: 0,
  expectedDocuments: 1,
  ...overrides,
});

export const costEstimate = (overrides: Partial<ICostEstimate> = {}): ICostEstimate => ({
  documents: 1,
  credits: 0,
  needs_extra_document: false,
  extra_document_cost: 0,
  total_credits: 0,
  breakdown: [],
  document_balance: 10,
  credit_balance: 5,
  has_sufficient_resources: true,
  blocking_reason: null,
  message: null,
  ...overrides,
});

export const assignment = (overrides: Partial<IAssignment> = {}): IAssignment => ({
  id: 'assignment-1',
  method: 'virtual',
  signers: [
    {
      id: 'signer-1',
      full_name: 'Ana Souza',
      email: 'ana@example.invalid',
      verification_method: 'Email',
      notification_methods: ['Email'],
      step: null,
      notified: true,
      completed: false,
    },
  ],
  summary: { signer_count: 1, completed_count: 0, signers: [] },
  signing_urls: [{ signer_id: 'signer-1', url: LEAK_SENTINELS[3] }],
  ...overrides,
});

export const documentDetails = (overrides: Partial<IDocumentDetailsResponse> = {}): IDocumentDetailsResponse => ({
  id: 'doc-1',
  account_id: 'account-1',
  name: 'Service agreement.pdf',
  status: 'metadata_ready',
  assignment: null,
  pages: [],
  created_at: '2026-09-25T11:00:00.000Z',
  updated_at: '2026-09-25T11:30:00.000Z',
  is_closed: false,
  ...overrides,
});

export const templateItem = (overrides: Partial<ITemplateListItem> = {}): ITemplateListItem => ({
  id: 'template-1',
  name: 'Sales contract',
  document_name: 'Contract',
  status: 'Ready',
  roles: [
    { id: 'role-client', name: 'Client', assignment_type: 'Signer' },
    { id: 'role-editor', name: 'Editor', assignment_type: 'Editor' },
  ],
  pages: [
    {
      id: 'page-1',
      number: 1,
      height: 1651,
      width: 1275,
      fields: [{ field_id: 'field-price', role_id: 'role-editor', label: 'Price' }],
    },
  ],
  created_at: '2026-09-01T10:00:00.000Z',
  ...overrides,
});

// A claimed PDF send that has not reached Assinafy yet.
export const documentRecord = (overrides: Partial<AssinafyDocumentRecord> = {}): AssinafyDocumentRecord =>
  buildDocumentRecord({
    id: 'record-doc-1',
    status: 'SENDING',
    assinafyAccountId: 'account-1',
    assinafyAssignmentId: null,
    requestId: REQUEST_ID,
    signers: null,
    sentAt: null,
    personId: RECORD_ID,
    updatedAt: NOW.toISOString(),
    ...overrides,
  });

// An upload the default member prepared in the default Assinafy workspace.
export const pendingUpload = (overrides: Partial<PendingUpload> = {}): PendingUpload => ({
  documentId: 'doc-1',
  accountId: 'account-1',
  userWorkspaceId: 'member-1',
  createdAt: NOW.toISOString(),
  ...overrides,
});
