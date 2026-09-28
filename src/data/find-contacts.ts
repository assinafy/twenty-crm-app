import { type CoreApiClient } from 'twenty-client-sdk/core';

import { findPeopleContacts } from 'src/data/find-people-contacts';
import { type Contact } from 'src/types/contact';

// In the order given; ids the caller cannot read are dropped, and a member who cannot read people gets none.
export const findContacts = async (core: CoreApiClient, personIds: string[]): Promise<Contact[]> => {
  if (personIds.length === 0) {
    return [];
  }

  const contacts = new Map(
    (await findPeopleContacts(core, { filter: { id: { in: personIds } }, first: personIds.length })).map((contact) => [
      contact.personId,
      contact,
    ]),
  );

  return personIds.flatMap((id) => contacts.get(id) ?? []);
};
