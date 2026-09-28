import { describe, expect, it } from 'vitest';

import { fakeCore } from 'src/data/__tests__/fake-core';
import { permissionDenied } from 'src/data/__tests__/permission-denied';
import { findAttachmentFile } from 'src/data/find-attachment-file';
import { type CrmRecord } from 'src/types/crm-record';

const opportunity: CrmRecord = {
  objectNameSingular: 'opportunity',
  id: 'record-1',
  name: 'Deal',
  primaryContactPersonId: null,
  companyId: null,
};

describe('findAttachmentFile', () => {
  it('reads the attachment only when it targets the record', async () => {
    const { core, query } = fakeCore({
      attachments: {
        edges: [{ node: { name: 'Contract.pdf', file: [{ label: 'file.pdf', url: 'https://files.test.invalid/1' }] } }],
      },
    });

    const file = await findAttachmentFile(core, opportunity, 'attachment-1');

    expect(query).toHaveBeenCalledWith({
      attachments: {
        __args: { filter: { id: { eq: 'attachment-1' }, targetOpportunityId: { eq: 'record-1' } }, first: 1 },
        edges: { node: { name: true, file: { label: true, url: true } } },
      },
    });
    expect(file).toEqual({ name: 'Contract.pdf', url: 'https://files.test.invalid/1' });
  });

  it('falls back to the file label for the name', async () => {
    const { core } = fakeCore({
      attachments: { edges: [{ node: { name: '', file: [{ label: 'file.pdf', url: 'https://files.test.invalid/1' }] } }] },
    });

    await expect(findAttachmentFile(core, opportunity, 'attachment-1')).resolves.toEqual({
      name: 'file.pdf',
      url: 'https://files.test.invalid/1',
    });
  });

  it('returns null to a member who cannot read attachments', async () => {
    const { core, query } = fakeCore(null);
    query.mockRejectedValue(permissionDenied({ attachments: null }));

    await expect(findAttachmentFile(core, opportunity, 'attachment-1')).resolves.toBeNull();
  });

  it.each([
    ['no attachment on the record', { attachments: { edges: [] } }],
    ['no connection', { attachments: null }],
    ['no file', { attachments: { edges: [{ node: { name: 'a.pdf', file: [] } }] } }],
    ['a file without url', { attachments: { edges: [{ node: { name: 'a.pdf', file: [{ label: 'a.pdf', url: null }] } }] } }],
  ])('returns null for %s', async (_label, result) => {
    const { core } = fakeCore(result);

    await expect(findAttachmentFile(core, opportunity, 'attachment-1')).resolves.toBeNull();
  });
});
