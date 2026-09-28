import { type AssinafyDocumentPatch } from 'src/types/assinafy-document-patch';

// FileItemInput rejects the read-only url; signers is a RAW_JSON array the generated JSON scalar types as an object.
export const toAssinafyDocumentInput = <T extends AssinafyDocumentPatch>({ signedDocument, signers, ...rest }: T) => ({
  ...rest,
  ...(signedDocument !== undefined && {
    signedDocument: signedDocument?.map(({ fileId, label }) => ({ fileId, label })) ?? null,
  }),
  ...(signers !== undefined && { signers: signers as Record<string, unknown> | null }),
});
