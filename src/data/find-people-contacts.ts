import { type CoreApiClient } from 'twenty-client-sdk/core';

import { PERSON_CONTACT_SELECTION } from 'src/data/person-contact-selection';
import { readPermitted } from 'src/data/read-permitted';
import { toContact } from 'src/data/to-contact';
import { type Contact } from 'src/types/contact';
import { type OrderByDirection } from 'src/types/order-by-direction';
import { type RecordConnection } from 'src/types/record-connection';

// Every field any query below selects; each query selects a subset.
type PeopleResult = { people?: RecordConnection<Parameters<typeof toContact>[0]> | null };

// Reads contacts in one query. Twenty denies the whole query both when the member cannot read people and when their
// role hides one selected field (e.g. phones), so a denied query is read again in parts: ids and names (the label
// identifier is always readable), then e-mails and phones on their own. A hidden field leaves only that field empty;
// a member who cannot read people (or the filter field) gets none.
export const findPeopleContacts = async (
  core: CoreApiClient,
  args: {
    filter: { id?: { in?: string[] }; companyId?: { eq?: string } };
    orderBy?: Array<{ createdAt?: OrderByDirection }>;
    first: number;
  },
): Promise<Contact[]> => {
  const { people }: PeopleResult = await readPermitted(() =>
    core.query({ people: { __args: args, edges: { node: PERSON_CONTACT_SELECTION } } }),
  );
  if (people) {
    return people.edges.map(({ node }) => toContact(node));
  }

  const { people: named }: PeopleResult = await readPermitted(() =>
    core.query({ people: { __args: args, edges: { node: { id: true, name: PERSON_CONTACT_SELECTION.name } } } }),
  );
  const nodes = named?.edges.map(({ node }) => node) ?? [];
  if (nodes.length === 0) {
    return [];
  }

  const byId = { filter: { id: { in: nodes.map(({ id }) => id) } }, first: nodes.length };
  const [{ people: emails }, { people: phones }] = await Promise.all([
    readPermitted<PeopleResult>(() =>
      core.query({ people: { __args: byId, edges: { node: { id: true, emails: PERSON_CONTACT_SELECTION.emails } } } }),
    ),
    readPermitted<PeopleResult>(() =>
      core.query({ people: { __args: byId, edges: { node: { id: true, phones: PERSON_CONTACT_SELECTION.phones } } } }),
    ),
  ]);
  const emailsById = new Map((emails?.edges ?? []).map(({ node }) => [node.id, node.emails]));
  const phonesById = new Map((phones?.edges ?? []).map(({ node }) => [node.id, node.phones]));

  return nodes.map((node) =>
    toContact({ ...node, emails: emailsById.get(node.id), phones: phonesById.get(node.id) }),
  );
};
