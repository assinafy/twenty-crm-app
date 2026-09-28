import { describe, expect, it } from 'vitest';

import { requiresSigningOrder } from 'src/utils/requires-signing-order.util';

describe('requiresSigningOrder', () => {
  it('is true when any signer uses a digital certificate', () => {
    expect(requiresSigningOrder([{ verificationMethod: 'Email' }, { verificationMethod: 'DigitalCertificate' }])).toBe(true);
  });

  it('is false for other methods and for no signers', () => {
    expect(requiresSigningOrder([{ verificationMethod: 'Email' }, { verificationMethod: 'Whatsapp' }])).toBe(false);
    expect(requiresSigningOrder([])).toBe(false);
  });
});
