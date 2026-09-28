import { describe, expect, it } from 'vitest';

import { buildSignerInput } from 'src/__tests__/fixtures/build-signer-input';
import { buildAssignmentSigners } from 'src/utils/build-assignment-signers.util';

describe('buildAssignmentSigners', () => {
  it('omits steps for parallel signing', () => {
    expect(
      buildAssignmentSigners(
        [
          { input: buildSignerInput(), assinafySignerId: 'signer-1' },
          {
            input: buildSignerInput({ verificationMethod: 'Whatsapp', notificationMethod: 'Whatsapp' }),
            assinafySignerId: 'signer-2',
          },
        ],
        false,
      ),
    ).toEqual([
      { id: 'signer-1', verification_method: 'Email', notification_methods: ['Email'] },
      { id: 'signer-2', verification_method: 'Whatsapp', notification_methods: ['Whatsapp'] },
    ]);
  });

  it('numbers steps 1..n when sequential', () => {
    const result = buildAssignmentSigners(
      [
        { input: buildSignerInput(), assinafySignerId: 'signer-1' },
        { input: buildSignerInput(), assinafySignerId: 'signer-2' },
      ],
      true,
    );
    expect(result.map((signer) => signer.step)).toEqual([1, 2]);
  });

  it('forces steps when any signer uses a digital certificate', () => {
    const result = buildAssignmentSigners(
      [
        { input: buildSignerInput(), assinafySignerId: 'signer-1' },
        {
          input: buildSignerInput({ verificationMethod: 'DigitalCertificate', governmentId: '00000000000' }),
          assinafySignerId: 'signer-2',
        },
      ],
      false,
    );
    expect(result).toEqual([
      { id: 'signer-1', verification_method: 'Email', notification_methods: ['Email'], step: 1 },
      { id: 'signer-2', verification_method: 'DigitalCertificate', notification_methods: ['Email'], step: 2 },
    ]);
  });
});
