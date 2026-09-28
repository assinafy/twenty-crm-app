import { type NotificationMethod } from 'src/types/notification-method';
import { type VerificationMethod } from 'src/types/verification-method';

// A signer as typed in the send flow, before validation.
export type SignerDraft = {
  name: string;
  email: string;
  phone: string;
  governmentId: string;
  verificationMethod: VerificationMethod;
  notificationMethod: NotificationMethod;
  // Template role this signer fills; null for PDF documents.
  roleId: string | null;
};
