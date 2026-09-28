import { SEND_LEASE_MS } from 'src/constants/limits';

// Whether a send claimed at updatedAt may still be running (or landing in Assinafy).
export const isWithinSendLease = (updatedAt: string, now: Date): boolean =>
  Date.parse(updatedAt) + SEND_LEASE_MS > now.getTime();
