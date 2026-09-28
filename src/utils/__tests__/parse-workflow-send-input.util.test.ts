import { describe, expect, it } from 'vitest';

import { parseWorkflowSendInput } from 'src/utils/parse-workflow-send-input.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });
const ATTACHMENT_ID = '1c8d4b3f-7a2e-4d9b-8f3c-6e5a4b2c3d4e';
const COMPANY_ID = '5a2b8f7d-1e6c-4b3f-8d7a-0b9c8d6e7f80';
const OPPORTUNITY_ID = '6b3c9a8e-2f7d-4c4a-9e8b-1c0d9e7f8091';
const personId = (index: number) => `4f1a7e6c-0d5b-4a2e-9c6f-${index.toString().padStart(12, '0')}`;

const body = (overrides: Record<string, unknown> = {}) => ({
  attachment: ATTACHMENT_ID,
  signers: [personId(1)],
  person: personId(1),
  ...overrides,
});

describe('parseWorkflowSendInput', () => {
  it('parses a minimal attachment send with defaults', () => {
    expect(parseWorkflowSendInput(body())).toEqual({
      attachmentId: ATTACHMENT_ID,
      templateId: null,
      signerPersonIds: [personId(1)],
      personId: personId(1),
      companyId: null,
      opportunityId: null,
      name: null,
      message: null,
      verificationMethod: 'Email',
      expiresInDays: null,
      maxCredits: 0,
    });
  });

  it('lowercases record and attachment ids', () => {
    const input = parseWorkflowSendInput(
      body({
        attachment: ATTACHMENT_ID.toUpperCase(),
        person: { id: personId(1).toUpperCase() },
        company: COMPANY_ID.toUpperCase(),
        opportunity: OPPORTUNITY_ID.toUpperCase(),
      }),
    );

    expect(input).toEqual(
      expect.objectContaining({
        attachmentId: ATTACHMENT_ID,
        personId: personId(1),
        companyId: COMPANY_ID,
        opportunityId: OPPORTUNITY_ID,
      }),
    );
  });

  it('accepts record inputs given as objects with an id', () => {
    const input = parseWorkflowSendInput(
      body({
        attachment: { id: ATTACHMENT_ID, name: 'contract.pdf' },
        signers: [{ id: personId(1), name: { firstName: 'Ana' } }, personId(2)],
        person: undefined,
        company: { id: COMPANY_ID },
        opportunity: OPPORTUNITY_ID,
      }),
    );

    expect(input).toEqual(
      expect.objectContaining({
        attachmentId: ATTACHMENT_ID,
        signerPersonIds: [personId(1), personId(2)],
        personId: null,
        companyId: COMPANY_ID,
        opportunityId: OPPORTUNITY_ID,
      }),
    );
  });

  it('parses a template send with every option', () => {
    const input = parseWorkflowSendInput(
      body({
        attachment: '',
        templateId: 'tpl_1',
        name: 'Contract',
        message: 'Please sign',
        verificationMethod: 'WhatsApp',
        expiresInDays: 365,
        maxCredits: 2.5,
      }),
    );

    expect(input).toEqual(
      expect.objectContaining({
        attachmentId: null,
        templateId: 'tpl_1',
        name: 'Contract',
        message: 'Please sign',
        verificationMethod: 'Whatsapp',
        expiresInDays: 365,
        maxCredits: 2.5,
      }),
    );
  });

  it.each([
    ['E-mail', 'Email'],
    ['WhatsApp', 'Whatsapp'],
  ])('maps the form option %s to the API value %s', (option, value) => {
    expect(parseWorkflowSendInput(body({ verificationMethod: option })).verificationMethod).toBe(value);
  });

  it.each(['Email', 'Whatsapp'])('rejects the API spelling %s, which the form does not offer', (option) => {
    expect(() => parseWorkflowSendInput(body({ verificationMethod: option }))).toThrow(
      expect.objectContaining({ code: 'INVALID_INPUT', details: { field: 'verificationMethod', reason: 'format' } }),
    );
  });

  it('reads numbers resolved from workflow variables as strings, and blanks as absent', () => {
    expect(parseWorkflowSendInput(body({ expiresInDays: '7', maxCredits: ' 1.5 ' }))).toEqual(
      expect.objectContaining({ expiresInDays: 7, maxCredits: 1.5 }),
    );
    expect(parseWorkflowSendInput(body({ expiresInDays: '', maxCredits: '  ' }))).toEqual(
      expect.objectContaining({ expiresInDays: null, maxCredits: 0 }),
    );
  });

  it('accepts 1 and 20 signers and 1 day', () => {
    const signers = Array.from({ length: 20 }, (_, index) => personId(index));

    expect(parseWorkflowSendInput(body({ signers })).signerPersonIds).toHaveLength(20);
    expect(parseWorkflowSendInput(body({ expiresInDays: 1 })).expiresInDays).toBe(1);
  });

  it.each([
    ['a non-object body', 'text', { field: 'body', reason: 'type' }],
    ['unknown keys', body({ record: personId(1) }), { field: 'body.record', reason: 'unknown_key' }],
    ['neither attachment nor template', body({ attachment: null }), { field: 'source', reason: 'required' }],
    ['both attachment and template', body({ templateId: 'tpl_1' }), { field: 'source', reason: 'conflict' }],
    ['a non-uuid attachment', body({ attachment: 'contract.pdf' }), { field: 'attachment', reason: 'format' }],
    [
      'a non-uuid attachment object id',
      body({ attachment: { id: 'contract.pdf' } }),
      { field: 'attachment', reason: 'format' },
    ],
    [
      'a template id over 64 characters',
      body({ attachment: undefined, templateId: 't'.repeat(65) }),
      { field: 'templateId', reason: 'too_long' },
    ],
    ['no signers', body({ signers: [] }), { field: 'signers', reason: 'too_few' }],
    ['missing signers', body({ signers: undefined }), { field: 'signers', reason: 'required' }],
    [
      '21 signers',
      body({ signers: Array.from({ length: 21 }, (_, index) => personId(index)) }),
      { field: 'signers', reason: 'too_many' },
    ],
    [
      'a non-uuid signer',
      body({ signers: [personId(1), { id: 'ana' }] }),
      { field: 'signers', reason: 'format', index: 1 },
    ],
    ['an empty signer', body({ signers: [null] }), { field: 'signers', reason: 'required', index: 0 }],
    ['no linked record', body({ person: null }), { field: 'record', reason: 'required' }],
    ['a non-uuid company', body({ company: 'Acme' }), { field: 'company', reason: 'format' }],
    ['a list of opportunities', body({ opportunity: [{ id: personId(9) }] }), { field: 'opportunity', reason: 'type' }],
    ['an empty list of opportunities', body({ opportunity: [] }), { field: 'opportunity', reason: 'type' }],
    ['a company object without an id', body({ company: { name: 'Acme' } }), { field: 'company', reason: 'type' }],
    ['a search result object', body({ opportunity: { first: { id: personId(9) } } }), { field: 'opportunity', reason: 'type' }],
    ['a list of attachments', body({ attachment: [{ id: personId(9) }] }), { field: 'attachment', reason: 'type' }],
    ['a nested signer list', body({ signers: [[personId(1)]] }), { field: 'signers', reason: 'type', index: 0 }],
    ['a 201 character name', body({ name: 'n'.repeat(201) }), { field: 'name', reason: 'too_long' }],
    ['a 1001 character message', body({ message: 'm'.repeat(1001) }), { field: 'message', reason: 'too_long' }],
    [
      'certificate verification',
      body({ verificationMethod: 'DigitalCertificate' }),
      { field: 'verificationMethod', reason: 'format' },
    ],
    ['0 days', body({ expiresInDays: 0 }), { field: 'expiresInDays', reason: 'out_of_range' }],
    ['366 days', body({ expiresInDays: 366 }), { field: 'expiresInDays', reason: 'out_of_range' }],
    ['fractional days', body({ expiresInDays: 1.5 }), { field: 'expiresInDays', reason: 'type' }],
    ['non-numeric days', body({ expiresInDays: 'soon' }), { field: 'expiresInDays', reason: 'type' }],
    ['negative credits', body({ maxCredits: -1 }), { field: 'maxCredits', reason: 'out_of_range' }],
  ])('rejects %s', (_label, raw, details) => {
    expect(() => parseWorkflowSendInput(raw)).toThrow(invalid(details));
  });
});
