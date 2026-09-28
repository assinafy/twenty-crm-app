import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { permissionDenied } from 'src/data/__tests__/permission-denied';
import { findContacts } from 'src/data/find-contacts';
import { PERSON_CONTACT_SELECTION } from 'src/data/person-contact-selection';

const person = (id: string, firstName: string) => ({
  id,
  name: { firstName, lastName: 'Test' },
  emails: { primaryEmail: `${firstName.toLowerCase()}@example.invalid` },
  phones: null,
});

describe('findContacts', () => {
  it('reads the people by id and keeps the requested order', async () => {
    const { core, query } = fakeCore({
      people: { edges: [{ node: person('p2', 'Bia') }, { node: person('p1', 'Ana') }] },
    });

    const contacts = await findContacts(core, ['p1', 'missing', 'p2']);

    expect(query).toHaveBeenCalledWith({
      people: {
        __args: { filter: { id: { in: ['p1', 'missing', 'p2'] } }, first: 3 },
        edges: { node: PERSON_CONTACT_SELECTION },
      },
    });
    expect(contacts).toEqual([
      { personId: 'p1', name: 'Ana Test', email: 'ana@example.invalid', phone: null },
      { personId: 'p2', name: 'Bia Test', email: 'bia@example.invalid', phone: null },
    ]);
  });

  it('skips the query for an empty list', async () => {
    const { core, query } = fakeCore({});

    await expect(findContacts(core, [])).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns an empty list when the connection is missing', async () => {
    const { core } = fakeCore({ people: null });

    await expect(findContacts(core, ['p1'])).resolves.toEqual([]);
  });

  it('returns an empty list when the member cannot read people', async () => {
    const { core, query } = fakeCore(null);
    query.mockRejectedValue(permissionDenied({ people: null }));

    await expect(findContacts(core, ['p1'])).resolves.toEqual([]);
  });
});
