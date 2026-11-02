import { type SignerInput } from 'src/types/signer-input';
import { type TemplateSummary } from 'src/types/template-summary';
import { invalidInput } from 'src/utils/invalid-input.util';

export const assertTemplateSigningMethods = (
  template: Pick<TemplateSummary, 'supportsDigitalCertificate'>,
  signers: ReadonlyArray<Pick<SignerInput, 'verificationMethod'>>,
): void => {
  if (
    !template.supportsDigitalCertificate &&
    signers.some(({ verificationMethod }) => verificationMethod === 'DigitalCertificate')
  ) {
    throw invalidInput('signers.verificationMethod', 'template_fields');
  }
};
