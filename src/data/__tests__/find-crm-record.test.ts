import { type CoreApiClient } from 'twenty-client-sdk/core';
import { describe, expect, it, vi } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { permissionDenied } from 'src/data/__tests__/permission-denied';
import { findCrmRecord } from 'src/data/find-crm-record';

const empty = { people: { edges: [] }, companies: { edges: [] }, opportunities: { edges: [] } };

describe('findCrmRecord', () => {
  it('asks people, companies and opportunities in one query', async () => {
    const { core, query } = fakeCore(empty);

    await findCrmRecord(core, 'record-1');

    const args = { filter: { id: { eq: 'record-1' } }, first: 1 };
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith({
      people: { __args: args, edges: { node: { id: true, name: { firstName: true, lastName: true }, companyId: true } } },
      companies: { __args: args, edges: { node: { id: true, name: true } } },
      opportunities: {
        __args: args,
        edges: { node: { id: true, name: true, pointOfContactId: true, companyId: true } },
      },
    });
  });

  it('maps a person as its own primary contact', async () => {
    const { core } = fakeCore({
      ...empty,
      people: { edges: [{ node: { id: 'p1', name: { firstName: 'Ana', lastName: 'Test' }, companyId: 'c1' } }] },
    });

    await expect(findCrmRecord(core, 'p1')).resolves.toEqual({
      objectNameSingular: 'person',
      id: 'p1',
      name: 'Ana Test',
      primaryContactPersonId: 'p1',
      companyId: 'c1',
    });
  });

  it('maps a person without company', async () => {
    const { core } = fakeCore({ ...empty, people: { edges: [{ node: { id: 'p1', name: null, companyId: null } }] } });

    await expect(findCrmRecord(core, 'p1')).resolves.toMatchObject({ name: '', companyId: null });
  });

  it('maps a company as its own contact source without a primary contact', async () => {
    const { core } = fakeCore({ ...empty, companies: { edges: [{ node: { id: 'c1', name: 'Acme' } }] } });

    await expect(findCrmRecord(core, 'c1')).resolves.toEqual({
      objectNameSingular: 'company',
      id: 'c1',
      name: 'Acme',
      primaryContactPersonId: null,
      companyId: 'c1',
    });
  });

  it('maps an opportunity to its point of contact and company', async () => {
    const { core } = fakeCore({
      ...empty,
      opportunities: { edges: [{ node: { id: 'o1', name: 'Deal', pointOfContactId: 'p1', companyId: 'c1' } }] },
    });

    await expect(findCrmRecord(core, 'o1')).resolves.toEqual({
      objectNameSingular: 'opportunity',
      id: 'o1',
      name: 'Deal',
      primaryContactPersonId: 'p1',
      companyId: 'c1',
    });
  });

  it('defaults missing names and links', async () => {
    const company = fakeCore({ ...empty, companies: { edges: [{ node: { id: 'c1', name: null } }] } });
    const opportunity = fakeCore({
      ...empty,
      opportunities: { edges: [{ node: { id: 'o1', name: null, pointOfContactId: null, companyId: null } }] },
    });

    await expect(findCrmRecord(company.core, 'c1')).resolves.toMatchObject({ name: '' });
    await expect(findCrmRecord(opportunity.core, 'o1')).resolves.toMatchObject({
      name: '',
      primaryContactPersonId: null,
      companyId: null,
    });
  });

  it('finds the record in the objects the member may read when another one is denied', async () => {
    const { core, query } = fakeCore(null);
    query.mockRejectedValue(
      permissionDenied({
        ...empty,
        people: { edges: [{ node: { id: 'p1', name: null, companyId: null } }] },
        opportunities: null,
      }),
    );

    await expect(findCrmRecord(core, 'p1')).resolves.toMatchObject({ objectNameSingular: 'person', id: 'p1' });
  });

  describe('when the role hides a link field', () => {
    type Request = Record<string, { edges: { node: Record<string, unknown> } }>;
    const RECORDS: Record<'people' | 'opportunities', Record<string, unknown>> = {
      people: { id: 'p1', name: { firstName: 'Ana', lastName: 'Test' }, companyId: 'c1' },
      opportunities: { id: 'o1', name: 'Deal', pointOfContactId: 'p1', companyId: 'c1' },
    };

    // Behaves like Twenty 2.42: a root selecting a field the role cannot read comes back null with a denial.
    const coreHiding = (root: 'people' | 'opportunities', hidden: string, record: 'people' | 'opportunities') => {
      const query = vi.fn<(request: Request) => Promise<unknown>>(async (request) => {
        let denied = false;
        const data = Object.fromEntries(
          Object.entries(request).map(([name, { edges }]) => {
            const selected = Object.keys(edges.node);
            if (name === root && selected.includes(hidden)) {
              denied = true;
              return [name, null];
            }
            const node = name === record ? Object.fromEntries(selected.map((field) => [field, RECORDS[record][field]])) : null;
            return [name, { edges: node ? [{ node }] : [] }];
          }),
        );
        if (denied) throw permissionDenied(data);
        return data;
      });
      return { core: { query } as unknown as CoreApiClient, query };
    };

    it('keeps a person whose company is hidden, without its company', async () => {
      const { core } = coreHiding('people', 'companyId', 'people');

      await expect(findCrmRecord(core, 'p1')).resolves.toEqual({
        objectNameSingular: 'person',
        id: 'p1',
        name: 'Ana Test',
        primaryContactPersonId: 'p1',
        companyId: null,
      });
    });

    it('keeps an opportunity whose point of contact is hidden, with its company', async () => {
      const { core } = coreHiding('opportunities', 'pointOfContactId', 'opportunities');

      await expect(findCrmRecord(core, 'o1')).resolves.toEqual({
        objectNameSingular: 'opportunity',
        id: 'o1',
        name: 'Deal',
        primaryContactPersonId: null,
        companyId: 'c1',
      });
    });

    it('keeps an opportunity whose company is hidden, with its point of contact', async () => {
      const { core } = coreHiding('opportunities', 'companyId', 'opportunities');

      await expect(findCrmRecord(core, 'o1')).resolves.toMatchObject({ primaryContactPersonId: 'p1', companyId: null });
    });

    it('does not ask a denied object again when another object holds the record', async () => {
      const { core, query } = coreHiding('people', 'companyId', 'opportunities');

      await expect(findCrmRecord(core, 'o1')).resolves.toMatchObject({ objectNameSingular: 'opportunity' });
      expect(query).toHaveBeenCalledTimes(1);
    });

    it('returns null when the denied objects do not hold the record either', async () => {
      const query = vi
        .fn<() => Promise<unknown>>()
        .mockRejectedValueOnce(permissionDenied({ ...empty, people: null, opportunities: null }))
        .mockResolvedValue({ people: { edges: [] }, opportunities: { edges: [] } });

      await expect(findCrmRecord({ query } as unknown as CoreApiClient, 'x1')).resolves.toBeNull();
      // One read of each denied object's name, and no link read.
      expect(query).toHaveBeenCalledTimes(3);
    });
  });

  it('returns null when no object has the id', async () => {
    const { core } = fakeCore({ people: null, companies: null, opportunities: null });

    await expect(findCrmRecord(core, 'record-1')).resolves.toBeNull();
  });
});
