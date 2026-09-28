import { type MetadataApiClient } from 'twenty-client-sdk/metadata';

import { SIGNED_DOCUMENT_FIELD_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Stores the bytes for assinafyDocument.signedDocument; the caller writes { fileId, label } into the field.
export const uploadSignedFile = async (
  metadata: MetadataApiClient,
  { buffer, filename }: { buffer: Buffer; filename: string },
): Promise<{ fileId: string; label: string }> => {
  const uploaded = await metadata.uploadFile({
    fileBuffer: buffer,
    filename,
    fieldMetadataUniversalIdentifier: SIGNED_DOCUMENT_FIELD_UNIVERSAL_IDENTIFIER,
  });

  return { fileId: uploaded.id, label: filename };
};
