import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { permissionDenied } from 'src/data/__tests__/permission-denied';
import { findCompanyContacts } from 'src/data/find-company-contacts';
import { PERSON_CONTACT_SELECTION } from 'src/data/person-contact-selection';

describe('findCompanyContacts', () => {
  it('reads the oldest people of the company up to the limit', async () => {
    const { core, query } = fakeCore({
      people: {
        edges: [
          {
            node: {
              id: 'p1',
              name: { firstName: 'Ana', lastName: 'Test' },
              emails: { primaryEmail: 'ana@example.invalid' },
              phones: { primaryPhoneCallingCode: '+55', primaryPhoneNumber: '11900000000' },
            },
          },
        ],
      },
    });

    const contacts = await findCompanyContacts(core, 'company-1', 10);

    expect(query).toHaveBeenCalledWith({
      people: {
        __args: { filter: { companyId: { eq: 'company-1' } }, orderBy: [{ createdAt: 'AscNullsLast' }], first: 10 },
        edges: { node: PERSON_CONTACT_SELECTION },
      },
    });
    expect(contacts).toEqual([
      { personId: 'p1', name: 'Ana Test', email: 'ana@example.invalid', phone: '+5511900000000' },
    ]);
  });

  it('returns an empty list when the connection is missing', async () => {
    const { core } = fakeCore({ people: null });

    await expect(findCompanyContacts(core, 'company-1', 10)).resolves.toEqual([]);
  });

  it('returns an empty list when the member cannot read people', async () => {
    const { core, query } = fakeCore(null);
    query.mockRejectedValue(permissionDenied({ people: null }));

    await expect(findCompanyContacts(core, 'company-1', 10)).resolves.toEqual([]);
  });
});
