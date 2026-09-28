import { type NotificationMethod } from 'src/types/notification-method';
import { type SignerInput } from 'src/types/signer-input';
import { type VerificationMethod } from 'src/types/verification-method';

export const buildEstimateSigners = (
  signers: SignerInput[],
): Array<{ role_id?: string; verification_method: VerificationMethod; notification_methods: [NotificationMethod] }> =>
  signers.map(({ roleId, verificationMethod, notificationMethod }) => ({
    ...(roleId === null ? {} : { role_id: roleId }),
    verification_method: verificationMethod,
    notification_methods: [notificationMethod],
  }));
