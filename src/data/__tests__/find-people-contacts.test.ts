import { type CoreApiClient } from 'twenty-client-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import { permissionDenied } from 'src/data/__tests__/permission-denied';
import { findPeopleContacts } from 'src/data/find-people-contacts';
import { PERSON_CONTACT_SELECTION } from 'src/data/person-contact-selection';

const PEOPLE = [
  {
    id: 'p1',
    name: { firstName: 'Ana', lastName: 'Test' },
    emails: { primaryEmail: 'ana@example.invalid' },
    phones: { primaryPhoneCallingCode: '+55', primaryPhoneNumber: '11900000000' },
  },
  {
    id: 'p2',
    name: { firstName: 'Bia', lastName: 'Test' },
    emails: { primaryEmail: 'bia@example.invalid' },
    phones: { primaryPhoneCallingCode: '+55', primaryPhoneNumber: '11911111111' },
  },
];

type PeopleRequest = { people: { __args: { filter: { id?: { in: string[] } } }; edges: { node: object } } };

// Behaves like Twenty 2.42: a query selecting (or filtering on) a field the role cannot read is denied as a whole.
const coreHiding = (hidden: string[]) => {
  const query = vi.fn<(request: PeopleRequest) => Promise<unknown>>(async ({ people }) => {
    const selected = Object.keys(people.edges.node);
    if (selected.some((field) => hidden.includes(field))) {
      throw permissionDenied({ people: null });
    }
    const ids = (Reflect.get(people, '__args') as PeopleRequest['people']['__args']).filter.id?.in;
    const nodes = PEOPLE.filter(({ id }) => !ids || ids.includes(id)).map((person) =>
      Object.fromEntries(selected.map((field) => [field, person[field as keyof typeof person]])),
    );
    return { people: { edges: nodes.map((node) => ({ node })) } };
  });
  return { core: { query } as unknown as CoreApiClient, query };
};

const args = { filter: { companyId: { eq: 'company-1' } }, first: 10 };

describe('findPeopleContacts', () => {
  it('reads everything in one query when the member may', async () => {
    const { core, query } = coreHiding([]);

    await expect(findPeopleContacts(core, args)).resolves.toEqual([
      { personId: 'p1', name: 'Ana Test', email: 'ana@example.invalid', phone: '+5511900000000' },
      { personId: 'p2', name: 'Bia Test', email: 'bia@example.invalid', phone: '+5511911111111' },
    ]);
    expect(query).toHaveBeenCalledExactlyOnceWith({ people: { __args: args, edges: { node: PERSON_CONTACT_SELECTION } } });
  });

  it('leaves only the hidden field empty when the role hides phones', async () => {
    const { core, query } = coreHiding(['phones']);

    await expect(findPeopleContacts(core, args)).resolves.toEqual([
      { personId: 'p1', name: 'Ana Test', email: 'ana@example.invalid', phone: null },
      { personId: 'p2', name: 'Bia Test', email: 'bia@example.invalid', phone: null },
    ]);
    expect(query).toHaveBeenCalledWith({
      people: {
        __args: { filter: { id: { in: ['p1', 'p2'] } }, first: 2 },
        edges: { node: { id: true, emails: PERSON_CONTACT_SELECTION.emails } },
      },
    });
  });

  it('leaves only the hidden field empty when the role hides e-mails', async () => {
    const { core } = coreHiding(['emails']);

    await expect(findPeopleContacts(core, args)).resolves.toEqual([
      { personId: 'p1', name: 'Ana Test', email: null, phone: '+5511900000000' },
      { personId: 'p2', name: 'Bia Test', email: null, phone: '+5511911111111' },
    ]);
  });

  it('returns none when the member cannot read people', async () => {
    const { core, query } = coreHiding(['id']);

    await expect(findPeopleContacts(core, args)).resolves.toEqual([]);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('returns none without further reads when the parts match nobody', async () => {
    const { core, query } = coreHiding(['phones']);

    await expect(findPeopleContacts(core, { filter: { id: { in: ['missing'] } }, first: 1 })).resolves.toEqual([]);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
