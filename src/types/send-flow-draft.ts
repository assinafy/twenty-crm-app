import { type SignerDraft } from 'src/types/signer-draft';

// Everything the user typed in the send flow.
export type SendFlowDraft = {
  sourceType: 'PDF' | 'TEMPLATE';
  attachmentId: string | null;
  templateId: string | null;
  // Template editor field id → value.
  editorFields: Record<string, string>;
  name: string;
  message: string;
  // Optional deadline as a date input value (YYYY-MM-DD); signers can sign until the end of that day.
  expiresOn: string;
  sequential: boolean;
  signers: SignerDraft[];
};
