import { describe, expect, it } from 'vitest';

import { CONTEXT } from 'src/front-components/utils/__tests__/send-flow-fixtures';
import { createSendFlowState } from 'src/front-components/utils/create-send-flow-state.util';
import { parseToolCallProposal } from 'src/front-components/utils/parse-tool-call-proposal.util';

const INVALID = { ok: false, error: { code: 'INTERNAL', message: 'Unexpected tool output' } };

// Twenty 2.42 stripEmptyValues: drops null, '', empty arrays and empty objects at every depth.
const stripEmptyValues = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(stripEmptyValues).filter((item) => item !== undefined);
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value)
      .map(([key, item]) => [key, stripEmptyValues(item)] as const)
      .filter(([, item]) => item !== undefined && item !== null && item !== '');
    const kept = entries.filter(([, item]) => !(Array.isArray(item) && item.length === 0));

    return kept.length === 0 ? undefined : Object.fromEntries(kept);
  }
  return value === null || value === '' ? undefined : value;
};

// What useToolCall().output holds once the chat ran the logic function.
const asChatOutput = (handlerResult: unknown) =>
  JSON.parse(
    JSON.stringify(
      stripEmptyValues({ success: true, message: 'Logic function executed successfully', result: handlerResult }),
    ),
  ) as Record<string, unknown>;

const signer = {
  name: 'Ana Lima',
  email: 'ana@example.invalid',
  phone: null,
  verificationMethod: 'Email',
  notificationMethod: 'Email',
  governmentId: null,
  roleId: null,
};

describe('parseToolCallProposal', () => {
  it('accepts a PDF proposal as the chat delivers it', () => {
    const output = asChatOutput({
      ok: true,
      proposal: {
        recordId: 'record-1',
        source: { type: 'PDF', attachmentId: 'att-1' },
        name: 'Contrato',
        message: null,
        signers: [signer],
      },
    });

    expect(parseToolCallProposal(output)).toEqual({
      ok: true,
      proposal: {
        recordId: 'record-1',
        source: { type: 'PDF', attachmentId: 'att-1' },
        name: 'Contrato',
        message: null,
        signers: [
          { name: 'Ana Lima', email: 'ana@example.invalid', verificationMethod: 'Email', notificationMethod: 'Email' },
        ],
      },
    });
  });

  it('restores the empty values the chat stripped', () => {
    const output = asChatOutput({
      ok: true,
      proposal: { recordId: 'record-1', source: null, name: null, message: null, signers: [] },
    });

    expect(parseToolCallProposal(output)).toEqual({
      ok: true,
      proposal: { recordId: 'record-1', source: null, name: null, message: null, signers: [] },
    });
  });

  it('restores the editor fields of a template proposal so the flow opens', () => {
    const output = asChatOutput({
      ok: true,
      proposal: {
        recordId: CONTEXT.record.id,
        source: { type: 'TEMPLATE', templateId: 'template-1', editorFields: [] },
        name: null,
        message: null,
        signers: [],
      },
    });
    const parsed = parseToolCallProposal(output);

    expect(parsed).toMatchObject({
      ok: true,
      proposal: { source: { type: 'TEMPLATE', templateId: 'template-1', editorFields: [] }, signers: [] },
    });
    expect(parsed.ok && createSendFlowState(CONTEXT, parsed.proposal).draft.templateId).toBe('template-1');
  });

  it('passes a tool failure through with its code and details', () => {
    const output = asChatOutput({
      ok: false,
      error: { code: 'INVALID_INPUT', message: '', details: { field: 'attachmentId', reason: 'not_found' } },
    });

    expect(parseToolCallProposal(output)).toEqual({
      ok: false,
      error: { code: 'INVALID_INPUT', message: '', details: { field: 'attachmentId', reason: 'not_found' } },
    });
  });

  it('accepts the bare handler result', () => {
    expect(parseToolCallProposal({ ok: false, error: { code: 'NOT_FOUND', message: 'No record' } })).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'No record' },
    });
    expect(parseToolCallProposal({ ok: true, proposal: { recordId: 'record-1' } })).toMatchObject({
      ok: true,
      proposal: { recordId: 'record-1', signers: [] },
    });
  });

  it.each([
    undefined,
    {},
    { success: false, message: 'Logic function execution failed', error: 'boom' },
    { success: true, message: 'Logic function executed successfully' },
    { success: true, result: { ok: false } },
    { success: true, result: { ok: false, error: { code: 3 } } },
    { success: true, result: { ok: true } },
    { success: true, result: { ok: true, proposal: { signers: [] } } },
    { success: true, result: { ok: true, proposal: { recordId: 'record-1', signers: 'Ana' } } },
    { ok: 'yes', proposal: { recordId: 'record-1' } },
  ])('rejects %j', (output) => {
    expect(parseToolCallProposal(output)).toEqual(INVALID);
  });

  const template = { type: 'TEMPLATE', templateId: 't', editorFields: [{ fieldId: 'f', value: 'v' }] };

  it.each([
    [{ type: 'PDF' }, null],
    [{ type: 'TEMPLATE' }, null],
    ['PDF', null],
    [template, template],
  ])('reads the source %j as %j', (source, expected) => {
    expect(parseToolCallProposal({ ok: true, proposal: { recordId: 'r', source } })).toMatchObject({
      proposal: { source: expected },
    });
  });
});
