import { expect, it } from 'vitest';

import { PERSON_CONTACT_SELECTION } from 'src/data/person-contact-selection';

it('selects every person field toContact reads', () => {
  expect(PERSON_CONTACT_SELECTION).toEqual({
    id: true,
    name: { firstName: true, lastName: true },
    emails: { primaryEmail: true },
    phones: { primaryPhoneNumber: true, primaryPhoneCallingCode: true },
  });
});
