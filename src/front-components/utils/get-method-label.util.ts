import { msg, type MessageDescriptor } from 'twenty-sdk/front-component';

import { type NotificationMethod } from 'src/types/notification-method';
import { type VerificationMethod } from 'src/types/verification-method';

const METHOD_LABELS: Record<VerificationMethod | NotificationMethod, MessageDescriptor> = {
  Email: msg('E-mail'),
  Whatsapp: msg('WhatsApp'),
  DigitalCertificate: msg('Certificado digital ICP-Brasil (A1 ou A3)'),
};

// Verification and invitation methods share the Email and WhatsApp labels.
export const getMethodLabel = (method: VerificationMethod | NotificationMethod): MessageDescriptor =>
  METHOD_LABELS[method];
