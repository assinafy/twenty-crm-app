import { type NotificationMethod } from 'src/types/notification-method';
import { type SignerInput } from 'src/types/signer-input';
import { type VerificationMethod } from 'src/types/verification-method';
import { requiresSigningOrder } from 'src/utils/requires-signing-order.util';

export const buildEstimateSigners = (
  signers: SignerInput[],
  sequential: boolean,
): Array<{ role_id?: string; verification_method: VerificationMethod; notification_methods: [NotificationMethod]; step?: number }> => {
  const ordered = sequential || requiresSigningOrder(signers);
  return signers.map(({ roleId, verificationMethod, notificationMethod }, index) => ({
    ...(roleId === null ? {} : { role_id: roleId }),
    verification_method: verificationMethod,
    notification_methods: [notificationMethod],
    ...(ordered ? { step: index + 1 } : {}),
  }));
};
