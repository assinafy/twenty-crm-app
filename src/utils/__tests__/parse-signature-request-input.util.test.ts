import { describe, expect, it } from 'vitest';

import { parseSignatureRequestInput } from 'src/utils/parse-signature-request-input.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });
const now = new Date('2026-09-25T12:00:00.000Z');
const RECORD_ID = '0b7c3a2e-6f1d-4c8a-9e2b-5d4f3a1b2c3d';
const ATTACHMENT_ID = '1c8d4b3f-7a2e-4d9b-8f3c-6e5a4b2c3d4e';

const emailSigner = { name: 'Ana Test', email: 'ana@example.invalid', verificationMethod: 'Email' };
const certificateSigner = {
  name: 'Caio Test',
  email: 'caio@example.invalid',
  verificationMethod: 'DigitalCertificate',
  governmentId: '00000000191',
};

const pdfBody = (overrides: Record<string, unknown> = {}) => ({
  recordId: RECORD_ID,
  source: { type: 'PDF', attachmentId: ATTACHMENT_ID },
  name: 'Contract',
  signers: [emailSigner],
  ...overrides,
});
const templateBody = (overrides: Record<string, unknown> = {}) => ({
  recordId: RECORD_ID,
  source: { type: 'TEMPLATE', templateId: 'tpl_1', editorFields: [{ fieldId: 'f1', value: ' Acme ' }] },
  name: 'Contract',
  signers: [{ ...emailSigner, roleId: 'role-1' }],
  ...overrides,
});

describe('parseSignatureRequestInput', () => {
  it('parses a minimal PDF request with defaults', () => {
    expect(parseSignatureRequestInput(pdfBody(), now)).toEqual({
      recordId: RECORD_ID,
      source: { type: 'PDF', attachmentId: ATTACHMENT_ID },
      name: 'Contract',
      signers: [expect.objectContaining({ email: 'ana@example.invalid', roleId: null })],
      message: null,
      expiresAt: null,
      sequential: false,
      assinafyDocumentId: null,
    });
  });

  it('parses a complete PDF request', () => {
    const input = parseSignatureRequestInput(
      pdfBody({
        message: '  Please sign  ',
        expiresAt: '2026-09-25T13:00:00Z',
        sequential: true,
        assinafyDocumentId: 'doc_A-1',
      }),
      now,
    );

    expect(input).toEqual(
      expect.objectContaining({
        message: 'Please sign',
        expiresAt: '2026-09-25T13:00:00.000Z',
        sequential: true,
        assinafyDocumentId: 'doc_A-1',
      }),
    );
  });

  it('parses a TEMPLATE request with editor fields', () => {
    expect(parseSignatureRequestInput(templateBody(), now)).toEqual(
      expect.objectContaining({
        source: { type: 'TEMPLATE', templateId: 'tpl_1', editorFields: [{ fieldId: 'f1', value: 'Acme' }] },
        signers: [expect.objectContaining({ roleId: 'role-1' })],
      }),
    );
  });

  it('defaults TEMPLATE editor fields to none', () => {
    const body = templateBody({ source: { type: 'TEMPLATE', templateId: 'tpl_1' } });

    expect(parseSignatureRequestInput(body, now).source).toEqual({ type: 'TEMPLATE', templateId: 'tpl_1', editorFields: [] });
  });

  it('keeps the requested signing order for certificate signers', () => {
    expect(parseSignatureRequestInput(pdfBody({ signers: [emailSigner, certificateSigner] }), now).sequential).toBe(false);
    expect(parseSignatureRequestInput(pdfBody({ sequential: true, signers: [certificateSigner] }), now).sequential).toBe(
      true,
    );
  });

  describe('rejects', () => {
    it.each([
      ['a non-object body', 'body', { field: 'body', reason: 'type' }],
      ['unknown keys', pdfBody({ connectionId: 'x' }), { field: 'body.connectionId', reason: 'unknown_key' }],
      ['a non-uuid record id', pdfBody({ recordId: 'record-1' }), { field: 'recordId', reason: 'format' }],
      ['a missing source', pdfBody({ source: undefined }), { field: 'source', reason: 'type' }],
      ['an unknown source type', pdfBody({ source: { type: 'DOCX' } }), { field: 'source.type', reason: 'format' }],
      [
        'a source without a type',
        templateBody({ source: { templateId: 'tpl_1' } }),
        { field: 'source.type', reason: 'required' },
      ],
      [
        'a template source without a template id',
        templateBody({ source: { type: 'TEMPLATE' } }),
        { field: 'source.templateId', reason: 'required' },
      ],
      [
        'an editor field without an id',
        templateBody({ source: { type: 'TEMPLATE', templateId: 'tpl_1', editorFields: [{ value: 'v' }] } }),
        { field: 'source.editorFields.fieldId', reason: 'required', index: 0 },
      ],
      [
        'a non-uuid attachment id',
        pdfBody({ source: { type: 'PDF', attachmentId: 'file.pdf' } }),
        { field: 'source.attachmentId', reason: 'format' },
      ],
      [
        'template keys on a PDF source',
        pdfBody({ source: { type: 'PDF', attachmentId: ATTACHMENT_ID, templateId: 'tpl_1' } }),
        { field: 'source.templateId', reason: 'unknown_key' },
      ],
      [
        'PDF keys on a TEMPLATE source',
        templateBody({ source: { type: 'TEMPLATE', templateId: 'tpl_1', attachmentId: ATTACHMENT_ID } }),
        { field: 'source.attachmentId', reason: 'unknown_key' },
      ],
      [
        'unknown source keys',
        pdfBody({ source: { type: 'PDF', attachmentId: ATTACHMENT_ID, url: 'x' } }),
        { field: 'source.url', reason: 'unknown_key' },
      ],
      [
        'a template id over 64 characters',
        templateBody({ source: { type: 'TEMPLATE', templateId: 't'.repeat(65) } }),
        { field: 'source.templateId', reason: 'too_long' },
      ],
      [
        'more than 50 editor fields',
        templateBody({
          source: {
            type: 'TEMPLATE',
            templateId: 'tpl_1',
            editorFields: Array.from({ length: 51 }, (_, index) => ({ fieldId: `f${index}`, value: 'v' })),
          },
        }),
        { field: 'source.editorFields', reason: 'too_many' },
      ],
      [
        'an editor field value over the limit',
        templateBody({ source: { type: 'TEMPLATE', templateId: 'tpl_1', editorFields: [{ fieldId: 'f1', value: 'v'.repeat(501) }] } }),
        { field: 'source.editorFields.value', reason: 'too_long', index: 0 },
      ],
      [
        'an empty editor field value',
        templateBody({ source: { type: 'TEMPLATE', templateId: 'tpl_1', editorFields: [{ fieldId: 'f1', value: ' ' }] } }),
        { field: 'source.editorFields.value', reason: 'required', index: 0 },
      ],
      [
        'an editor field id over 64 characters',
        templateBody({ source: { type: 'TEMPLATE', templateId: 'tpl_1', editorFields: [{ fieldId: 'f'.repeat(65), value: 'v' }] } }),
        { field: 'source.editorFields.fieldId', reason: 'too_long', index: 0 },
      ],
      [
        'unknown editor field keys',
        templateBody({ source: { type: 'TEMPLATE', templateId: 'tpl_1', editorFields: [{ fieldId: 'f1', value: 'v', label: 'x' }] } }),
        { field: 'source.editorFields.label', reason: 'unknown_key', index: 0 },
      ],
      ['a 201 character name', pdfBody({ name: 'n'.repeat(201) }), { field: 'name', reason: 'too_long' }],
      ['a whitespace-only name', pdfBody({ name: '   ' }), { field: 'name', reason: 'required' }],
      ['a 1001 character message', pdfBody({ message: 'm'.repeat(1001) }), { field: 'message', reason: 'too_long' }],
      ['a non-boolean sequential', pdfBody({ sequential: 'yes' }), { field: 'sequential', reason: 'type' }],
      [
        'an expiry under one hour',
        pdfBody({ expiresAt: '2026-09-25T12:59:00Z' }),
        { field: 'expiresAt', reason: 'too_soon' },
      ],
      [
        'an impossible expiry date',
        pdfBody({ expiresAt: '2027-02-30T10:00:00Z' }),
        { field: 'expiresAt', reason: 'format' },
      ],
      [
        'a malformed Assinafy document id',
        pdfBody({ assinafyDocumentId: '../doc' }),
        { field: 'assinafyDocumentId', reason: 'format' },
      ],
      [
        'an Assinafy document id on a template',
        templateBody({ assinafyDocumentId: 'doc_1' }),
        { field: 'assinafyDocumentId', reason: 'not_allowed' },
      ],
      [
        'a role id on a PDF signer',
        pdfBody({ signers: [{ ...emailSigner, roleId: 'role-1' }] }),
        { field: 'signers.roleId', reason: 'not_allowed', index: 0 },
      ],
      [
        'template signers without roles',
        templateBody({ signers: [emailSigner] }),
        { field: 'signers.roleId', reason: 'required', index: 0 },
      ],
    ])('%s', (_label, body, details) => {
      expect(() => parseSignatureRequestInput(body, now)).toThrow(invalid(details));
    });
  });

  it('skips the lead-time check when asked, and keeps it by default', () => {
    const body = pdfBody({ expiresAt: '2026-09-25T11:00:00Z' });

    expect(parseSignatureRequestInput(body, now, null).expiresAt).toBe('2026-09-25T11:00:00.000Z');
    expect(() => parseSignatureRequestInput(body, now)).toThrow(invalid({ field: 'expiresAt', reason: 'too_soon' }));
  });

  it('lowercases the record and attachment ids', () => {
    const input = parseSignatureRequestInput(
      pdfBody({ recordId: RECORD_ID.toUpperCase(), source: { type: 'PDF', attachmentId: ATTACHMENT_ID.toUpperCase() } }),
      now,
    );

    expect(input.recordId).toBe(RECORD_ID);
    expect(input.source).toEqual({ type: 'PDF', attachmentId: ATTACHMENT_ID });
  });

  it('accepts a 200 character name, a 1000 character message and an empty message', () => {
    const input = parseSignatureRequestInput(pdfBody({ name: 'n'.repeat(200), message: 'm'.repeat(1000) }), now);

    expect(input.name).toHaveLength(200);
    expect(input.message).toHaveLength(1000);
    expect(parseSignatureRequestInput(pdfBody({ message: '' }), now).message).toBeNull();
  });
});
