import { type SignatureSource } from 'src/types/signature-source';
import { type SignerInput } from 'src/types/signer-input';

// Validated body shared by /assinafy/prepare and /assinafy/send.
export type SignatureRequestInput = {
  recordId: string;
  source: SignatureSource;
  name: string;
  signers: SignerInput[];
  message: string | null;
  expiresAt: string | null;
  sequential: boolean;
  // PDF: the upload returned by a previous prepare, re-estimated instead of uploaded again.
  assinafyDocumentId: string | null;
};
