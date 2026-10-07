import { ASSINAFY_WEBHOOK_EMAIL_VARIABLE } from 'src/constants/assinafy';
import { isValidEmail } from 'src/utils/is-valid-email.util';

// The contact email that turns webhooks on; null (webhooks off) when blank or not an email address.
export const readWebhookEmail = (): string | null => {
  const email = process.env[ASSINAFY_WEBHOOK_EMAIL_VARIABLE]?.trim();
  return email && isValidEmail(email) ? email : null;
};
