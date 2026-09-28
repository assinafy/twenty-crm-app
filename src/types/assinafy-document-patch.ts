import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

// Writable assinafyDocument fields (relations are set only when the record is created).
export type AssinafyDocumentPatch = Partial<
  Omit<AssinafyDocumentRecord, 'id' | 'updatedAt' | 'personId' | 'companyId' | 'opportunityId'>
>;
