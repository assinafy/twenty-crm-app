import { describe, expect, it } from 'vitest';

import { assertTemplateSigningMethods } from 'src/utils/assert-template-signing-methods.util';

describe('assertTemplateSigningMethods', () => {
  it('accepts certificates only when the template produces a virtual assignment', () => {
    const certificate = [{ verificationMethod: 'DigitalCertificate' as const }];

    expect(() => assertTemplateSigningMethods({ supportsDigitalCertificate: true }, certificate)).not.toThrow();
    expect(() => assertTemplateSigningMethods({ supportsDigitalCertificate: false }, certificate)).toThrow(
      expect.objectContaining({
        code: 'INVALID_INPUT',
        details: { field: 'signers.verificationMethod', reason: 'template_fields' },
      }),
    );
  });

  it('allows every non-certificate verification method on a collect template', () => {
    expect(() =>
      assertTemplateSigningMethods(
        { supportsDigitalCertificate: false },
        [
          { verificationMethod: 'Email' },
          { verificationMethod: 'Whatsapp' },
          { verificationMethod: 'IdDocumentFaceMatchBasic' },
        ],
      ),
    ).not.toThrow();
  });
});
