import { describe, expect, it } from 'vitest';

import document from 'src/objects/assinafy-document.object';

describe('signature mirror permissions', () => {
  it('keeps the label editable and denies member updates to every mirrored field', () => {
    expect(document.config.isUICreatable).toBe(false);
    const fields = document.config.fields ?? [];
    expect(fields.find(({ name }) => name === 'name')?.disabledFieldPermissionActions ?? []).toEqual([]);
    expect(fields.length).toBeGreaterThan(1);
    for (const field of fields.filter(({ name }) => name !== 'name')) {
      expect(field).toMatchObject({
        isUIEditable: false,
        disabledFieldPermissionActions: ['canUpdateFieldValue'],
      });
    }
  });
});
