import { type StoredSigner } from 'src/types/stored-signer';

// An invited signer who has not signed yet.
export const buildStoredSigner = (overrides: Partial<StoredSigner> = {}): StoredSigner => ({
  id: 'signer-1',
  name: 'Ana Souza',
  email: 'ana@example.invalid',
  phone: null,
  verificationMethod: 'Email',
  notificationMethod: 'Email',
  step: null,
  notified: true,
  completed: false,
  deliveryFailed: false,
  declined: false,
  ...overrides,
});
