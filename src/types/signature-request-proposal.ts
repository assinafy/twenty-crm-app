import { type SignatureSource } from 'src/types/signature-source';
import { type SignerInput } from 'src/types/signer-input';

// Output of the propose-signature-request AI tool; the tool-call card prefills the send flow with it.
export type SignatureRequestProposal = {
  recordId: string;
  source: SignatureSource | null;
  name: string | null;
  message: string | null;
  signers: SignerInput[];
};
