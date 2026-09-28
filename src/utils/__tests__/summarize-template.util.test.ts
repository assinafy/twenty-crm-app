import { type ITemplateListItem } from '@assinafy/sdk';
import { describe, expect, it } from 'vitest';

import { summarizeTemplate } from 'src/utils/summarize-template.util';

const template = (overrides: Partial<ITemplateListItem> = {}): ITemplateListItem => ({
  id: 'template-1',
  name: 'Service agreement',
  document_name: 'agreement.pdf',
  status: 'Ready',
  roles: [
    { id: 'role-client', name: 'Client', assignment_type: 'Signer' },
    { id: 'role-editor', name: 'TemplateEditor', assignment_type: 'Editor' },
    { id: 'role-witness', name: 'Witness', assignment_type: 'signer' },
  ],
  pages: [
    {
      id: 'page-1',
      number: 1,
      height: 1651,
      width: 1275,
      fields: [
        { field_id: 'field-price', role_id: 'role-editor', label: 'Price' },
        { field_id: 'field-date', role_id: 'role-editor' },
        { field_id: 'field-signature', role_id: 'role-client', label: 'Signature' },
      ],
    },
    {
      id: 'page-2',
      number: 2,
      height: 1651,
      width: 1275,
      fields: [
        { field_id: 'field-price', role_id: 'role-editor', label: 'Price again' },
        { role_id: 'role-editor', label: 'No field id' },
        { field_id: 'field-orphan', label: 'No role' },
      ],
    },
    { id: 'page-3', number: 3, height: 1651, width: 1275 },
  ],
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const signers = (count: number) =>
  Array.from({ length: count }, (_, index) => ({ id: `role-${index}`, name: `Role ${index}`, assignment_type: 'Signer' }));

describe('summarizeTemplate', () => {
  it('summarizes a ready template with title-case status and role types', () => {
    expect(summarizeTemplate(template())).toEqual({
      id: 'template-1',
      name: 'Service agreement',
      documentName: 'agreement.pdf',
      signerRoles: [
        { id: 'role-client', name: 'Client' },
        { id: 'role-witness', name: 'Witness' },
      ],
      editorFields: [
        { fieldId: 'field-price', label: 'Price' },
        { fieldId: 'field-date', label: 'field-date' },
      ],
      unsupportedReason: null,
    });
  });

  it('accepts a lowercase ready status', () => {
    expect(summarizeTemplate(template({ status: 'ready' }))).not.toBeNull();
  });

  it.each(['Uploaded', 'processing', 'failed', ''])('skips a template with status %o', (status) => {
    expect(summarizeTemplate(template({ status }))).toBeNull();
  });

  it('flags roles other than signer and editor', () => {
    const result = summarizeTemplate(
      template({
        roles: [
          { id: 'role-client', name: 'Client', assignment_type: 'Signer' },
          { id: 'role-copy', name: 'Copy', assignment_type: 'CopyReceiver' },
        ],
      }),
    );
    expect(result).toMatchObject({ unsupportedReason: 'UNSUPPORTED_ROLES', signerRoles: [{ id: 'role-client' }] });
  });

  it('flags a template with more signer roles or editor fields than a request accepts', () => {
    const withFields = (count: number) =>
      template({
        pages: [
          {
            id: 'page-1',
            number: 1,
            height: 1651,
            width: 1275,
            fields: Array.from({ length: count }, (_, index) => ({ field_id: `field-${index}`, role_id: 'role-editor' })),
          },
        ],
      });

    expect(summarizeTemplate(template({ roles: signers(21) }))?.unsupportedReason).toBe('TOO_LARGE');
    expect(summarizeTemplate(template({ roles: signers(20) }))?.unsupportedReason).toBeNull();
    expect(summarizeTemplate(withFields(51))?.unsupportedReason).toBe('TOO_LARGE');
    expect(summarizeTemplate(withFields(50))?.unsupportedReason).toBeNull();
    expect(
      summarizeTemplate(template({ roles: [...signers(21), { id: 'role-copy', name: 'Copy', assignment_type: 'CopyReceiver' }] }))
        ?.unsupportedReason,
    ).toBe('UNSUPPORTED_ROLES');
  });

  it('flags a role without a type', () => {
    const result = summarizeTemplate(
      template({ roles: [{ id: 'role-client', name: 'Client', assignment_type: 'Signer' }, { id: 'r', name: 'R' }] }),
    );
    expect(result?.unsupportedReason).toBe('UNSUPPORTED_ROLES');
  });

  it('flags a template without signer roles', () => {
    const result = summarizeTemplate(
      template({ roles: [{ id: 'role-editor', name: 'TemplateEditor', assignment_type: 'Editor' }] }),
    );
    expect(result).toMatchObject({ unsupportedReason: 'UNSUPPORTED_ROLES', signerRoles: [] });
  });

  it('handles missing roles, pages and document name', () => {
    const { roles: _roles, pages: _pages, document_name: _documentName, ...bare } = template();
    expect(summarizeTemplate(bare)).toEqual({
      id: 'template-1',
      name: 'Service agreement',
      documentName: null,
      signerRoles: [],
      editorFields: [],
      unsupportedReason: 'UNSUPPORTED_ROLES',
    });
  });
});
