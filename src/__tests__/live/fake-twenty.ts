import { randomUUID } from 'node:crypto';

import type { createAssinafyDocument as CreateAssinafyDocument } from 'src/data/create-assinafy-document';
import type { findAssinafyDocuments as FindAssinafyDocuments } from 'src/data/find-assinafy-documents';
import type { findAttachmentFile as FindAttachmentFile } from 'src/data/find-attachment-file';
import type { findCrmRecord as FindCrmRecord } from 'src/data/find-crm-record';
import type { updateAssinafyDocument as UpdateAssinafyDocument } from 'src/data/update-assinafy-document';
import type { uploadSignedFile as UploadSignedFile } from 'src/data/upload-signed-file';
import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';
import { type CrmRecord } from 'src/types/crm-record';

// In-memory stand-in for the Twenty data layer: the live suite mocks each src/data module that talks to Twenty with
// this one (type-only imports above, so it never loads the modules it replaces).

export const CRM_RECORD: CrmRecord = {
  objectNameSingular: 'person',
  id: randomUUID(),
  name: 'Live Test Person',
  primaryContactPersonId: null,
  companyId: null,
};

export const ATTACHMENT = { id: randomUUID(), name: 'Live test.pdf', url: 'https://files.example.invalid/live-test.pdf' };

export const records = new Map<string, AssinafyDocumentRecord>();
export const signedFiles: Array<{ fileId: string; label: string; buffer: Buffer }> = [];

export const findCrmRecord: typeof FindCrmRecord = async (_core, recordId) =>
  recordId === CRM_RECORD.id ? CRM_RECORD : null;

export const findAttachmentFile: typeof FindAttachmentFile = async (_core, record, attachmentId) =>
  record.id === CRM_RECORD.id && attachmentId === ATTACHMENT.id ? { name: ATTACHMENT.name, url: ATTACHMENT.url } : null;

type FakeFilter = Record<string, unknown>;

// The operators the exercised paths use: eq lookups (id, requestId, assinafyDocumentId) and findUploadReference's
// `or` of `neq` and `is`. SQL semantics: NULL never equals or differs from a value. Any other operator throws, so an
// unsupported filter fails the run instead of matching everything.
const matches = (record: AssinafyDocumentRecord, filter: FakeFilter): boolean =>
  Object.entries(filter).every(([field, condition]) => {
    if (field === 'and') return (condition as FakeFilter[]).every((sub) => matches(record, sub));
    if (field === 'or') return (condition as FakeFilter[]).some((sub) => matches(record, sub));
    const value = record[field as keyof AssinafyDocumentRecord] ?? null;
    const operators = Object.entries(condition as FakeFilter);
    if (operators.length !== 1) throw new Error(`fake-twenty: one operator per field (${field})`);
    const [[operator, operand]] = operators as [[string, unknown]];
    if (operator === 'eq') return value !== null && value === operand;
    if (operator === 'neq') return value !== null && value !== operand;
    if (operator === 'is') return operand === 'NULL' ? value === null : value !== null;
    throw new Error(`fake-twenty: unsupported operator ${operator} on ${field}`);
  });

export const findAssinafyDocuments: typeof FindAssinafyDocuments = async (_core, { filter, first }) =>
  [...records.values()].filter((record) => matches(record, filter as FakeFilter)).slice(0, first);

export const createAssinafyDocument: typeof CreateAssinafyDocument = async (_core, data) => {
  // Mirrors the unique requestId index.
  if ([...records.values()].some((record) => record.requestId === data.requestId)) {
    throw new Error('duplicate key value violates unique constraint');
  }
  const record: AssinafyDocumentRecord = {
    assinafyDocumentId: null,
    assinafyAccountId: null,
    assinafyAssignmentId: null,
    templateName: null,
    signerCount: null,
    signedCount: null,
    signers: null,
    sentAt: null,
    completedAt: null,
    expiresAt: null,
    lastSyncedAt: null,
    declineReason: null,
    lastError: null,
    signedDocument: null,
    ...data,
    personId: data.personId ?? null,
    companyId: data.companyId ?? null,
    opportunityId: data.opportunityId ?? null,
    id: randomUUID(),
    updatedAt: new Date().toISOString(),
  };
  records.set(record.id, record);
  return record;
};

export const updateAssinafyDocument: typeof UpdateAssinafyDocument = async (_core, id, patch) => {
  const current = records.get(id);
  if (!current) {
    throw new Error(`No assinafyDocument ${id}`);
  }
  const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
  records.set(id, updated);
  return updated;
};

export const uploadSignedFile: typeof UploadSignedFile = async (_metadata, { buffer, filename }) => {
  const file = { fileId: randomUUID(), label: filename };
  signedFiles.push({ ...file, buffer });
  return file;
};
