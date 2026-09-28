import { describe, expect, it } from 'vitest';

import { toContact } from 'src/data/to-contact';

describe('toContact', () => {
  it('maps name, primary email and an E.164 phone', () => {
    expect(
      toContact({
        id: 'person-1',
        name: { firstName: 'Ana', lastName: 'Test' },
        emails: { primaryEmail: ' ana@example.invalid ' },
        phones: { primaryPhoneCallingCode: '+55', primaryPhoneNumber: '(11) 90000-0000' },
      }),
    ).toEqual({ personId: 'person-1', name: 'Ana Test', email: 'ana@example.invalid', phone: '+5511900000000' });
  });

  it('returns null contact details when they are missing or blank', () => {
    expect(
      toContact({
        id: 'person-1',
        name: null,
        emails: { primaryEmail: ' ' },
        phones: { primaryPhoneCallingCode: '+55', primaryPhoneNumber: null },
      }),
    ).toEqual({ personId: 'person-1', name: '', email: null, phone: null });
    expect(toContact({ id: 'person-2' })).toEqual({ personId: 'person-2', name: '', email: null, phone: null });
  });
});
