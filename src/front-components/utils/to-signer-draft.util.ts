import { type SignerDraft } from 'src/types/signer-draft';
import { type SignerInput } from 'src/types/signer-input';

// Prefills a signer from a CRM contact or a proposed signer; Email verification is the default (it costs no credits).
export const toSignerDraft = (from: Partial<SignerInput> | null, roleId: string | null = null): SignerDraft => ({
  name: from?.name ?? '',
  email: from?.email ?? '',
  phone: from?.phone ?? '',
  governmentId: from?.governmentId ?? '',
  verificationMethod: from?.verificationMethod ?? 'Email',
  notificationMethod: from?.notificationMethod ?? 'Email',
  roleId,
});
