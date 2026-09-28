import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { permissionDenied } from 'src/data/__tests__/permission-denied';
import { findPdfAttachments } from 'src/data/find-pdf-attachments';
import { type CrmRecord } from 'src/types/crm-record';

const record = (objectNameSingular: CrmRecord['objectNameSingular']): CrmRecord => ({
  objectNameSingular,
  id: 'record-1',
  name: 'Record',
  primaryContactPersonId: null,
  companyId: null,
});

describe('findPdfAttachments', () => {
  it.each([
    ['person', 'targetPersonId'],
    ['company', 'targetCompanyId'],
    ['opportunity', 'targetOpportunityId'],
  ] as const)('reads the newest 50 attachments of a %s', async (objectNameSingular, targetField) => {
    const { core, query } = fakeCore({ attachments: { edges: [] } });

    await findPdfAttachments(core, record(objectNameSingular));

    expect(query).toHaveBeenCalledWith({
      attachments: {
        __args: { filter: { [targetField]: { eq: 'record-1' } }, orderBy: [{ createdAt: 'DescNullsLast' }], first: 50 },
        edges: { node: { id: true, name: true, file: { label: true, extension: true } } },
      },
    });
  });

  it('keeps PDFs by extension or name, in the order returned', async () => {
    const { core } = fakeCore({
      attachments: {
        edges: [
          { node: { id: 'a1', name: 'Contract', file: [{ label: 'Contract', extension: 'PDF' }] } },
          { node: { id: 'a2', name: 'Photo.png', file: [{ label: 'Photo.png', extension: 'png' }] } },
          { node: { id: 'a3', name: 'Scan.PDF', file: null } },
          { node: { id: 'a4', name: '', file: [{ label: 'Label.pdf', extension: '.pdf' }] } },
          { node: { id: 'a5', name: '', file: [{ label: '', extension: 'pdf' }] } },
          { node: { id: 'a6', name: '', file: [] } },
          { node: { id: 'a7', name: '', file: [{ label: 'Unnamed.pdf', extension: null }] } },
        ],
      },
    });

    await expect(findPdfAttachments(core, record('person'))).resolves.toEqual([
      { id: 'a1', name: 'Contract' },
      { id: 'a3', name: 'Scan.PDF' },
      { id: 'a4', name: 'Label.pdf' },
      { id: 'a5', name: 'documento.pdf' },
      { id: 'a7', name: 'Unnamed.pdf' },
    ]);
  });

  it('returns an empty list to a member who cannot read attachments', async () => {
    const { core, query } = fakeCore(null);
    query.mockRejectedValue(permissionDenied({ attachments: null }));

    await expect(findPdfAttachments(core, record('person'))).resolves.toEqual([]);
  });

  it('returns an empty list when the connection is missing', async () => {
    const { core } = fakeCore({ attachments: null });

    await expect(findPdfAttachments(core, record('company'))).resolves.toEqual([]);
  });
});
