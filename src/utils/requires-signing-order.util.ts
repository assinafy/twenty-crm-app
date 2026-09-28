import { type SignerInput } from 'src/types/signer-input';

// Assinafy requires a certificate signer to sign alone in its step, so any certificate signer forces a signing order.
export const requiresSigningOrder = (signers: ReadonlyArray<Pick<SignerInput, 'verificationMethod'>>): boolean =>
  signers.some((signer) => signer.verificationMethod === 'DigitalCertificate');
