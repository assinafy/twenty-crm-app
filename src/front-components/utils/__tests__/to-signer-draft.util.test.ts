import { describe, expect, it } from 'vitest';

import { toSignerDraft } from 'src/front-components/utils/to-signer-draft.util';

describe('toSignerDraft', () => {
  it('creates a blank email signer', () => {
    expect(toSignerDraft(null)).toEqual({
      name: '',
      email: '',
      phone: '',
      governmentId: '',
      verificationMethod: 'Email',
      notificationMethod: 'Email',
      roleId: null,
    });
  });

  it('copies a contact and a proposed signer', () => {
    expect(
      toSignerDraft(
        {
          name: 'Ana',
          email: null,
          phone: '+15550100001',
          verificationMethod: 'Whatsapp',
          notificationMethod: 'Whatsapp',
        },
        'role-1',
      ),
    ).toEqual({
      name: 'Ana',
      email: '',
      phone: '+15550100001',
      governmentId: '',
      verificationMethod: 'Whatsapp',
      notificationMethod: 'Whatsapp',
      roleId: 'role-1',
    });
  });
});
