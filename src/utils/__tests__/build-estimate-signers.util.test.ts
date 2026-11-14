import { describe, expect, it } from 'vitest';

import { buildSignerInput } from 'src/__tests__/fixtures/build-signer-input';
import { buildEstimateSigners } from 'src/utils/build-estimate-signers.util';

describe('buildEstimateSigners', () => {
  it('prices channels and required signing order without contact data', () => {
    expect(
      buildEstimateSigners([
        buildSignerInput(),
        buildSignerInput({ phone: '+5511999990000', verificationMethod: 'Whatsapp', notificationMethod: 'Whatsapp' }),
        buildSignerInput({ verificationMethod: 'DigitalCertificate', notificationMethod: 'Email', governmentId: '00000000000' }),
      ], false),
    ).toEqual([
      { verification_method: 'Email', notification_methods: ['Email'], step: 1 },
      { verification_method: 'Whatsapp', notification_methods: ['Whatsapp'], step: 2 },
      { verification_method: 'DigitalCertificate', notification_methods: ['Email'], step: 3 },
    ]);
  });

  it('prices an explicitly sequential email request in the same order as sending', () => {
    expect(buildEstimateSigners([buildSignerInput(), buildSignerInput()], true).map(({ step }) => step)).toEqual([1, 2]);
  });

  it('adds the template role when present', () => {
    expect(buildEstimateSigners([buildSignerInput({ roleId: 'role-1' })], false)).toEqual([
      { role_id: 'role-1', verification_method: 'Email', notification_methods: ['Email'] },
    ]);
  });
});
