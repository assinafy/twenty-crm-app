import { type CoreApiClient } from 'twenty-client-sdk/core';

import { findPeopleContacts } from 'src/data/find-people-contacts';
import { type Contact } from 'src/types/contact';

// A member who cannot read people gets an empty list.
export const findCompanyContacts = (core: CoreApiClient, companyId: string, limit: number): Promise<Contact[]> =>
  findPeopleContacts(core, {
    filter: { companyId: { eq: companyId } },
    orderBy: [{ createdAt: 'AscNullsLast' }],
    first: limit,
  });
