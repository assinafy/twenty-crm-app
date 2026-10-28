import { type AssinafyDocumentRecord } from 'src/types/assinafy-document-record';

// An assinafyDocument as a query selecting ASSINAFY_DOCUMENT_SELECTION returns it. genql types nullable fields as
// optional.
export type AssinafyDocumentNode = Partial<Omit<AssinafyDocumentRecord, 'signers' | 'signedDocument' | 'contractDetails'>> &
  Pick<AssinafyDocumentRecord, 'id' | 'updatedAt'> & {
    signers?: unknown;
    contractDetails?: unknown;
    signedDocument?: Array<{ fileId: string; label: string; url?: string | null } | null> | null;
  };
