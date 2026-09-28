import { describe, expect, it } from 'vitest';

import { parseProposalInput } from 'src/utils/parse-proposal-input.util';

const invalid = (details: Record<string, unknown>) => expect.objectContaining({ code: 'INVALID_INPUT', details });
const RECORD_ID = '0b7c3a2e-6f1d-4c8a-9e2b-5d4f3a1b2c3d';
const ATTACHMENT_ID = '1c8d4b3f-7a2e-4d9b-8f3c-6e5a4b2c3d4e';
const personId = (index: number) => `4f1a7e6c-0d5b-4a2e-9c6f-${index.toString().padStart(12, '0')}`;

describe('parseProposalInput', () => {
  it('fills every suggestion with null or empty by default', () => {
    expect(parseProposalInput({ recordId: RECORD_ID })).toEqual({
      recordId: RECORD_ID,
      sourceType: null,
      attachmentId: null,
      templateId: null,
      signerPersonIds: [],
      name: null,
      message: null,
    });
  });

  it('parses every suggestion', () => {
    expect(
      parseProposalInput({
        recordId: RECORD_ID,
        sourceType: 'PDF',
        attachmentId: ATTACHMENT_ID,
        templateId: 'tpl_1',
        signerPersonIds: [personId(1), personId(2)],
        name: ' Contract ',
        message: 'Please sign',
      }),
    ).toEqual({
      recordId: RECORD_ID,
      sourceType: 'PDF',
      attachmentId: ATTACHMENT_ID,
      templateId: 'tpl_1',
      signerPersonIds: [personId(1), personId(2)],
      name: 'Contract',
      message: 'Please sign',
    });
  });

  it('lowercases the attachment id', () => {
    expect(parseProposalInput({ recordId: RECORD_ID, attachmentId: ATTACHMENT_ID.toUpperCase() }).attachmentId).toBe(
      ATTACHMENT_ID,
    );
  });

  it('accepts 20 signers', () => {
    const signerPersonIds = Array.from({ length: 20 }, (_, index) => personId(index));

    expect(parseProposalInput({ recordId: RECORD_ID, signerPersonIds }).signerPersonIds).toHaveLength(20);
  });

  it.each([
    [{}, { field: 'recordId', reason: 'required' }],
    [{ recordId: RECORD_ID, sourceType: 'DOCX' }, { field: 'sourceType', reason: 'format' }],
    [{ recordId: RECORD_ID, attachmentId: 'contract.pdf' }, { field: 'attachmentId', reason: 'format' }],
    [{ recordId: RECORD_ID, templateId: 't'.repeat(65) }, { field: 'templateId', reason: 'too_long' }],
    [
      { recordId: RECORD_ID, signerPersonIds: Array.from({ length: 21 }, (_, index) => personId(index)) },
      { field: 'signerPersonIds', reason: 'too_many' },
    ],
    [
      { recordId: RECORD_ID, signerPersonIds: [personId(1), 'ana@example.invalid'] },
      { field: 'signerPersonIds', reason: 'format', index: 1 },
    ],
    [{ recordId: RECORD_ID, name: 'n'.repeat(201) }, { field: 'name', reason: 'too_long' }],
    [{ recordId: RECORD_ID, message: 'm'.repeat(1001) }, { field: 'message', reason: 'too_long' }],
    [{ recordId: RECORD_ID, signers: [] }, { field: 'body.signers', reason: 'unknown_key' }],
  ])('rejects %j', (body, details) => {
    expect(() => parseProposalInput(body)).toThrow(invalid(details));
  });
});
