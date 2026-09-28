import { type NotificationMethod } from 'src/types/notification-method';
import { type VerificationMethod } from 'src/types/verification-method';

// Signer progress persisted in assinafyDocument.signers. Never holds signing URLs or government ids.
export type StoredSigner = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  verificationMethod: VerificationMethod | null;
  notificationMethod: NotificationMethod | null;
  step: number | null;
  notified: boolean | null;
  completed: boolean | null;
  deliveryFailed: boolean;
  // The signer who declined the document (Assinafy declined_by).
  declined: boolean;
};
