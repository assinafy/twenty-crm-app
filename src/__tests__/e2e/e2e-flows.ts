import { expect, inject } from 'vitest';

import { graphql } from 'src/__tests__/e2e/graphql';
import { poll } from 'src/__tests__/e2e/poll';
import { psql } from 'src/__tests__/e2e/psql';
import { simulator } from 'src/__tests__/e2e/simulator-client';
import { type CrmFixtures } from 'src/__tests__/integration/crm-fixtures';
import { callRoute } from 'src/__tests__/integration/twenty-api';
import { KV_PENDING_UPLOADS } from 'src/constants/kv-keys';
import { SEND_MIN_EXPIRATION_MINUTES } from 'src/constants/limits';
import { type DocumentSummary } from 'src/types/document-summary';
import { type PendingUpload } from 'src/types/pending-upload';
import { type PreparedSignatureRequest } from 'src/types/prepared-signature-request';
import { type TemplateSummary } from 'src/types/template-summary';

// A reserved address: invitations to it go nowhere.
export const E2E_SIGNER = { name: 'Assinante E2E', email: 'e2e-signer@example.invalid', verificationMethod: 'Email' };

// The shortest deadline the send accepts (SEND_MIN_EXPIRATION_MINUTES) plus a 2-minute margin for request latency, so a
// request the run leaves behind expires about an hour later.
export const shortDeadline = () => new Date(Date.now() + (SEND_MIN_EXPIRATION_MINUTES + 2) * 60_000).toISOString();

const TEMPLATE_ID = process.env.ASSINAFY_LIVE_TEMPLATE_ID?.trim() || null;

// The template the suite sends: ASSINAFY_LIVE_TEMPLATE_ID when set, else the first ready one with a single signer role
// (the suite gives every role the same signer). Undefined when none qualifies; throws when the named one does not.
const sendable = ({ unsupportedReason, signerRoles }: TemplateSummary) => unsupportedReason === null && signerRoles.length === 1;

export const findSendableTemplate = (templates: TemplateSummary[]): TemplateSummary | undefined => {
  if (TEMPLATE_ID === null) return templates.find(sendable);
  const named = templates.find(({ id }) => id === TEMPLATE_ID);
  if (!named || !sendable(named)) {
    throw new Error('ASSINAFY_LIVE_TEMPLATE_ID must name a ready sandbox template with one signer role.');
  }
  return named;
};

export const SENDABLE_TEMPLATE_MISSING =
  'The sandbox lists no template sendable with one signer role; set ASSINAFY_LIVE_TEMPLATE_ID to one.';

export const pdfRequest = (crm: CrmFixtures, name: string) => ({
  recordId: crm.person.id,
  source: { type: 'PDF', attachmentId: crm.pdfAttachment.id },
  name,
  signers: [E2E_SIGNER],
  expiresAt: shortDeadline(),
});

export const prepare = async (token: string, request: object): Promise<PreparedSignatureRequest> => {
  const prepared = await callRoute<PreparedSignatureRequest>('/s/assinafy/prepare', token, request);
  expect(prepared.ok ? 'OK' : prepared.error.code).toBe('OK');
  return prepared as unknown as PreparedSignatureRequest;
};

// The body the review step sends: the prepared upload, a fresh idempotency key and the estimate the member accepted.
export const sendBody = (request: object, prepared: PreparedSignatureRequest, requestId = crypto.randomUUID()) => ({
  ...request,
  assinafyDocumentId: prepared.assinafyDocumentId,
  requestId,
  accountId: prepared.accountId,
  expectedTotalCredits: prepared.estimate.totalCredits,
  expectedDocuments: prepared.estimate.documents,
});

// Prepares and sends a PDF as the review step does; fails unless the send is confirmed.
export const sendPdf = async (token: string, crm: CrmFixtures, name: string) => {
  const request = pdfRequest(crm, name);
  const prepared = await prepare(token, request);
  const body = sendBody(request, prepared);
  const summary = await callRoute<DocumentSummary>('/s/assinafy/send', token, body);
  expect(summary).toMatchObject({ ok: true, status: 'PENDING_SIGNATURE' });
  return { prepared, body, summary: summary as unknown as DocumentSummary & { ok: true } };
};

export type DocumentRow = {
  id: string;
  name: string;
  status: string;
  requestId: string | null;
  assinafyDocumentId: string | null;
  assinafyAccountId: string | null;
  assinafyAssignmentId: string | null;
  signerCount: number | null;
  signedCount: number | null;
  signers: Array<{ id: string; notified: boolean | null; completed: boolean | null }> | null;
  lastError: string | null;
  lastSyncedAt: string | null;
  sentAt: string | null;
  personId: string | null;
};

export const findDocumentRecords = async (filter: Record<string, unknown>): Promise<DocumentRow[]> => {
  const { assinafyDocuments } = await graphql<{ assinafyDocuments: { edges: Array<{ node: DocumentRow }> } }>(
    'graphql',
    `query ($filter: AssinafyDocumentFilterInput) { assinafyDocuments(filter: $filter) { edges { node {
      id name status requestId assinafyDocumentId assinafyAccountId assinafyAssignmentId signerCount signedCount signers
      lastError lastSyncedAt sentAt personId } } } }`,
    { filter },
  );
  return assinafyDocuments.edges.map(({ node }) => node);
};

export const findDocumentRecord = async (id: string): Promise<DocumentRow | undefined> =>
  (await findDocumentRecords({ id: { eq: id } }))[0];

// The app's pending-upload list, read straight from its key-value row (no API exposes it to a member).
export const readPendingUploads = async (applicationId: string): Promise<PendingUpload[]> => {
  const [row] = await psql<{ value: PendingUpload[] | null }>(
    `select value from core."keyValuePair" where "applicationId" = '${applicationId}' and key = '${KV_PENDING_UPLOADS}'`,
  );
  return row?.value ?? [];
};

// Rewrites one pending-upload entry in place (to age it, or to hand it to another member).
export const patchPendingUpload = async (applicationId: string, documentId: string, patch: Partial<PendingUpload>) => {
  const entries = (await readPendingUploads(applicationId)).map((entry) =>
    entry.documentId === documentId ? { ...entry, ...patch } : entry,
  );
  const json = JSON.stringify(entries).replaceAll("'", "''");
  await psql(
    `update core."keyValuePair" set value = '${json}'::jsonb where "applicationId" = '${applicationId}' and key = '${KV_PENDING_UPLOADS}'`,
  );
};

// Assinafy refuses to delete an upload it is still processing (the app then leaves it to the purge); tests that expect
// an immediate delete wait for the processing to end.
export const waitUntilProcessed = (documentId: string) =>
  poll(
    () => simulator.documentStatus(inject('simApiKey'), documentId),
    (status) => status === 'metadata_ready',
    { timeoutMs: 90_000, intervalMs: 2_000, label: 'Assinafy to process the upload' },
  );
