import { describe, expect, it } from 'vitest';

import { getMethodLabel } from 'src/front-components/utils/get-method-label.util';

describe('getMethodLabel', () => {
  it('labels each method', () => {
    expect(getMethodLabel('IdDocumentFaceMatchBasic').message).toBe('Biometria facial e documento de identidade');
    expect(getMethodLabel('Email').message).toBe('E-mail');
    expect(getMethodLabel('Whatsapp').message).toBe('WhatsApp');
    expect(getMethodLabel('DigitalCertificate').message).toBe('Certificado digital ICP-Brasil (A1 ou A3)');
  });
});
