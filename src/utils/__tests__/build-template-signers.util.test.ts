import { describe, expect, it } from 'vitest';

import { buildSignerInput } from 'src/__tests__/fixtures/build-signer-input';
import { type SignerInput } from 'src/types/signer-input';
import { buildTemplateSigners } from 'src/utils/build-template-signers.util';

const input = (overrides: Partial<SignerInput> = {}) => buildSignerInput({ roleId: 'role-1', ...overrides });

describe('buildTemplateSigners', () => {
  it('adds each signer role to the assignment payload', () => {
    expect(
      buildTemplateSigners(
        [
          { input: input(), assinafySignerId: 'signer-1' },
          { input: input({ roleId: 'role-2' }), assinafySignerId: 'signer-2' },
        ],
        false,
      ),
    ).toEqual([
      { role_id: 'role-1', id: 'signer-1', verification_method: 'Email', notification_methods: ['Email'] },
      { role_id: 'role-2', id: 'signer-2', verification_method: 'Email', notification_methods: ['Email'] },
    ]);
  });

  it('forces steps when a certificate signer is present', () => {
    const result = buildTemplateSigners(
      [
        { input: input({ verificationMethod: 'DigitalCertificate', governmentId: '00000000000' }), assinafySignerId: 'a' },
        { input: input({ roleId: 'role-2' }), assinafySignerId: 'b' },
      ],
      false,
    );
    expect(result.map(({ role_id, step }) => ({ role_id, step }))).toEqual([
      { role_id: 'role-1', step: 1 },
      { role_id: 'role-2', step: 2 },
    ]);
  });

  it('rejects a signer without a role', () => {
    expect(() => buildTemplateSigners([{ input: input({ roleId: null }), assinafySignerId: 'a' }], false)).toThrow(
      expect.objectContaining({ code: 'INTERNAL' }),
    );
  });
});
