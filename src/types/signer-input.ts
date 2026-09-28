import { type NotificationMethod } from 'src/types/notification-method';
import { type VerificationMethod } from 'src/types/verification-method';

// A validated signer as sent by the front end (phone is E.164, governmentId digits only).
export type SignerInput = {
  name: string;
  email: string | null;
  phone: string | null;
  verificationMethod: VerificationMethod;
  notificationMethod: NotificationMethod;
  governmentId: string | null;
  // Template role this signer fills; null for PDF documents.
  roleId: string | null;
};
