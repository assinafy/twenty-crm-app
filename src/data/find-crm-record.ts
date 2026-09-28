import { type CoreApiClient } from 'twenty-client-sdk/core';

import { PERSON_CONTACT_SELECTION } from 'src/data/person-contact-selection';
import { readPermitted } from 'src/data/read-permitted';
import { toPersonName } from 'src/data/to-person-name';
import { type CrmRecord } from 'src/types/crm-record';

const toPerson = (person: { id: string; name?: Parameters<typeof toPersonName>[0] }, companyId: string | null) => ({
  objectNameSingular: 'person' as const,
  id: person.id,
  name: toPersonName(person.name),
  primaryContactPersonId: person.id,
  companyId,
});

const toOpportunity = (
  opportunity: { id: string; name?: string | null },
  pointOfContactId: string | null,
  companyId: string | null,
) => ({
  objectNameSingular: 'opportunity' as const,
  id: opportunity.id,
  name: opportunity.name ?? '',
  primaryContactPersonId: pointOfContactId,
  companyId,
});

// Record ids are unique across objects, so one round trip asks all three and at most one answers. An object the member
// cannot read counts as not holding the record. Twenty also denies a whole object when the role hides one selected
// field, so a denied person or opportunity is asked again for its id and name alone (the label identifier is always
// readable) and each link on its own: a hidden link is left empty instead of hiding the record.
export const findCrmRecord = async (core: CoreApiClient, recordId: string): Promise<CrmRecord | null> => {
  const args = { filter: { id: { eq: recordId } }, first: 1 };
  const { people, companies, opportunities } = await readPermitted(() =>
    core.query({
      people: { __args: args, edges: { node: { id: true, name: PERSON_CONTACT_SELECTION.name, companyId: true } } },
      companies: { __args: args, edges: { node: { id: true, name: true } } },
      opportunities: {
        __args: args,
        edges: { node: { id: true, name: true, pointOfContactId: true, companyId: true } },
      },
    }),
  );

  const person = people?.edges[0]?.node;
  if (person) return toPerson(person, person.companyId ?? null);

  const company = companies?.edges[0]?.node;
  if (company) {
    return {
      objectNameSingular: 'company',
      id: company.id,
      name: company.name ?? '',
      primaryContactPersonId: null,
      companyId: company.id,
    };
  }

  const opportunity = opportunities?.edges[0]?.node;
  if (opportunity) {
    return toOpportunity(opportunity, opportunity.pointOfContactId ?? null, opportunity.companyId ?? null);
  }

  if (!people) {
    const { people: named } = await readPermitted(() =>
      core.query({ people: { __args: args, edges: { node: { id: true, name: PERSON_CONTACT_SELECTION.name } } } }),
    );
    const namedPerson = named?.edges[0]?.node;
    if (namedPerson) {
      const { people: linked } = await readPermitted(() =>
        core.query({ people: { __args: args, edges: { node: { id: true, companyId: true } } } }),
      );
      return toPerson(namedPerson, linked?.edges[0]?.node.companyId ?? null);
    }
  }

  if (!opportunities) {
    const { opportunities: named } = await readPermitted(() =>
      core.query({ opportunities: { __args: args, edges: { node: { id: true, name: true } } } }),
    );
    const namedOpportunity = named?.edges[0]?.node;
    if (namedOpportunity) {
      const [{ opportunities: contact }, { opportunities: linkedCompany }] = await Promise.all([
        readPermitted(() =>
          core.query({ opportunities: { __args: args, edges: { node: { id: true, pointOfContactId: true } } } }),
        ),
        readPermitted(() =>
          core.query({ opportunities: { __args: args, edges: { node: { id: true, companyId: true } } } }),
        ),
      ]);
      return toOpportunity(
        namedOpportunity,
        contact?.edges[0]?.node.pointOfContactId ?? null,
        linkedCompany?.edges[0]?.node.companyId ?? null,
      );
    }
  }

  return null;
};
