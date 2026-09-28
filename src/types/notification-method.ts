import { type NOTIFICATION_METHODS } from 'src/constants/signer-methods';

export type NotificationMethod = (typeof NOTIFICATION_METHODS)[number];
