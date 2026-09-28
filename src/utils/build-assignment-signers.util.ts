import { type NotificationMethod } from 'src/types/notification-method';
import { type SignerInput } from 'src/types/signer-input';
import { type VerificationMethod } from 'src/types/verification-method';
import { requiresSigningOrder } from 'src/utils/requires-signing-order.util';

export const buildAssignmentSigners = (
  signers: Array<{ input: SignerInput; assinafySignerId: string }>,
  sequential: boolean,
): Array<{
  id: string;
  verification_method: VerificationMethod;
  notification_methods: [NotificationMethod];
  step?: number;
}> => {
  // A signing order gives each signer its own step.
  const ordered = sequential || requiresSigningOrder(signers.map(({ input }) => input));

  return signers.map(({ input, assinafySignerId }, index) => ({
    id: assinafySignerId,
    verification_method: input.verificationMethod,
    notification_methods: [input.notificationMethod],
    ...(ordered ? { step: index + 1 } : {}),
  }));
};
