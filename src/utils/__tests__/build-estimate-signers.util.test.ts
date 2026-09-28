import { describe, expect, it } from 'vitest';

import { buildSignerInput } from 'src/__tests__/fixtures/build-signer-input';
import { buildEstimateSigners } from 'src/utils/build-estimate-signers.util';

describe('buildEstimateSigners', () => {
  it('prices channels only, without contact data', () => {
    expect(
      buildEstimateSigners([
        buildSignerInput(),
        buildSignerInput({ phone: '+5511999990000', verificationMethod: 'Whatsapp', notificationMethod: 'Whatsapp' }),
        buildSignerInput({ verificationMethod: 'DigitalCertificate', notificationMethod: 'Email', governmentId: '00000000000' }),
      ]),
    ).toEqual([
      { verification_method: 'Email', notification_methods: ['Email'] },
      { verification_method: 'Whatsapp', notification_methods: ['Whatsapp'] },
      { verification_method: 'DigitalCertificate', notification_methods: ['Email'] },
    ]);
  });

  it('adds the template role when present', () => {
    expect(buildEstimateSigners([buildSignerInput({ roleId: 'role-1' })])).toEqual([
      { role_id: 'role-1', verification_method: 'Email', notification_methods: ['Email'] },
    ]);
  });
});
