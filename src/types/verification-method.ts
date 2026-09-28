import { type VERIFICATION_METHODS } from 'src/constants/signer-methods';

export type VerificationMethod = (typeof VERIFICATION_METHODS)[number];
