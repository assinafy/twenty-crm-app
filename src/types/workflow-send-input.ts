import { type VerificationMethod } from 'src/types/verification-method';

// Validated input of the "Send for signature" workflow action.
export type WorkflowSendInput = {
  attachmentId: string | null;
  templateId: string | null;
  signerPersonIds: string[];
  personId: string | null;
  companyId: string | null;
  opportunityId: string | null;
  name: string | null;
  message: string | null;
  verificationMethod: Extract<VerificationMethod, 'Email' | 'Whatsapp'>;
  expiresInDays: number | null;
  maxCredits: number;
};
