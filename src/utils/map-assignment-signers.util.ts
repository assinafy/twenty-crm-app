import { type IAssignment, type INotificationHistoryEntry } from '@assinafy/sdk';

import { NOTIFICATION_METHODS, VERIFICATION_METHODS } from 'src/constants/signer-methods';
import { type StoredSigner } from 'src/types/stored-signer';

const pick = <T extends string>(allowed: readonly T[], value: unknown): T | null =>
  allowed.find((candidate) => candidate === value) ?? null;

const timeOf = (entry: INotificationHistoryEntry): number => Date.parse(entry.failed_at ?? entry.sent_at ?? '') || 0;

// The history order is not documented, so the newest entry is chosen by timestamp (ties: the later one).
const lastDeliveryFailed = (history: INotificationHistoryEntry[] | null | undefined): boolean => {
  let latest: INotificationHistoryEntry | undefined;
  for (const entry of history ?? []) {
    if (!latest || timeOf(entry) >= timeOf(latest)) {
      latest = entry;
    }
  }
  return latest?.status === 'failed';
};

// Never copies signing URLs. `declinedBySignerId` undefined means Assinafy did not say who declined.
export const mapAssignmentSigners = (
  assignment: IAssignment | null | undefined,
  previous: StoredSigner[] | null,
  declinedBySignerId?: string | null,
): StoredSigner[] => {
  if (!assignment) {
    return previous ?? [];
  }
  return (assignment.signers ?? []).map((signer) => {
    const stored = previous?.find((candidate) => candidate.id === signer.id);
    const notificationMethod = pick(NOTIFICATION_METHODS, signer.notification_methods?.[0]);
    return {
      id: signer.id,
      name: signer.full_name,
      email: signer.email ?? null,
      // Account signers can carry a number from earlier sends; only a WhatsApp invitation uses it.
      phone: notificationMethod === 'Whatsapp' ? (signer.whatsapp_phone_number ?? null) : null,
      verificationMethod: pick(VERIFICATION_METHODS, signer.verification_method),
      notificationMethod,
      step: signer.step ?? null,
      notified: signer.notified ?? null,
      // Assinafy reports completion only to the document owner; keep what was known when it is absent.
      completed: signer.completed ?? stored?.completed ?? null,
      deliveryFailed: lastDeliveryFailed(signer.notification_history),
      declined: declinedBySignerId === undefined ? (stored?.declined ?? false) : signer.id === declinedBySignerId,
    };
  });
};
