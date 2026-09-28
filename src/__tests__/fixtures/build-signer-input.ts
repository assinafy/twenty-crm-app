import { type SignerInput } from 'src/types/signer-input';

// An Email signer with no role or government id.
export const buildSignerInput = (overrides: Partial<SignerInput> = {}): SignerInput => ({
  name: 'Ana Souza',
  email: 'ana@example.invalid',
  phone: null,
  verificationMethod: 'Email',
  notificationMethod: 'Email',
  governmentId: null,
  roleId: null,
  ...overrides,
});
