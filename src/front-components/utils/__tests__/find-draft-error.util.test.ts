import { describe, expect, it } from 'vitest';

import { CONTEXT, CONTRACT_ID } from 'src/front-components/utils/__tests__/send-flow-fixtures';
import { findDraftError } from 'src/front-components/utils/find-draft-error.util';
import { toSignerDraft } from 'src/front-components/utils/to-signer-draft.util';
import { type SendFlowDraft } from 'src/types/send-flow-draft';

const now = new Date('2026-09-25T12:00:00.000Z');
const ana = { ...toSignerDraft(null), name: 'Ana', email: 'ana@example.invalid' };
const pdfDraft = (overrides: Partial<SendFlowDraft> = {}): SendFlowDraft => ({
  sourceType: 'PDF',
  attachmentId: CONTRACT_ID,
  templateId: null,
  editorFields: {},
  name: 'Contract',
  message: '',
  expiresOn: '',
  sequential: false,
  signers: [ana],
  ...overrides,
});
const templateDraft = (overrides: Partial<SendFlowDraft> = {}): SendFlowDraft =>
  pdfDraft({
    sourceType: 'TEMPLATE',
    templateId: 'template-1',
    editorFields: { 'field-price': '100' },
    signers: [
      { ...ana, roleId: 'role-client' },
      { ...ana, email: 'bruno@example.invalid', roleId: 'role-witness' },
    ],
    ...overrides,
  });
const check = (draft: SendFlowDraft, step: 'DOCUMENT' | 'SIGNERS' = 'DOCUMENT') =>
  findDraftError({ draft, context: CONTEXT }, step, now);

describe('findDraftError', () => {
  it('accepts valid PDF and template drafts', () => {
    expect(check(pdfDraft())).toBeNull();
    expect(check(pdfDraft(), 'SIGNERS')).toBeNull();
    expect(check(templateDraft())).toBeNull();
    expect(check(templateDraft(), 'SIGNERS')).toBeNull();
  });

  it.each([
    ['no attachment', pdfDraft({ attachmentId: null }), { field: 'source.attachmentId', reason: 'required' }],
    ['no template', templateDraft({ templateId: null }), { field: 'source.templateId', reason: 'required' }],
    [
      'an unsupported template',
      templateDraft({ templateId: 'template-2' }),
      { field: 'source.templateId', reason: 'unsupported' },
    ],
    [
      'an empty editor field',
      templateDraft({ editorFields: { 'field-price': ' ' } }),
      { field: 'source.editorFields.value', reason: 'required', index: 0 },
    ],
    ['no name', pdfDraft({ name: ' ' }), { field: 'name', reason: 'required' }],
    ['a long name', pdfDraft({ name: 'x'.repeat(201) }), { field: 'name', reason: 'too_long' }],
    ['a long message', pdfDraft({ message: 'x'.repeat(1001) }), { field: 'message', reason: 'too_long' }],
  ])('reports %s on the document step', (_, draft, details) => {
    expect(check(draft)).toEqual(expect.objectContaining({ code: 'INVALID_INPUT', details }));
  });

  it('refuses a template with more signer roles or editor fields than a request accepts', () => {
    const [nda] = CONTEXT.templates;
    const draft = { draft: templateDraft(), context: { ...CONTEXT, templates: [{ ...nda!, unsupportedReason: 'TOO_LARGE' as const }] } };

    expect(findDraftError(draft, 'DOCUMENT', now)).toEqual(
      expect.objectContaining({ details: { field: 'source.templateId', reason: 'too_large' } }),
    );
  });

  it('requires a deadline with the send margin', () => {
    const today = { draft: pdfDraft({ expiresOn: '2026-09-25' }), context: CONTEXT };
    const tooSoon = expect.objectContaining({ details: { field: 'expiresAt', reason: 'too_soon' } });

    // The deadline is 23:59:59 local: 65 minutes and 59 seconds away at 22:54, 63 minutes and 59 seconds at 22:56.
    // Only the send's 65-minute margin rejects the second one; the prepare's 60-minute margin would accept it.
    expect(findDraftError(today, 'DOCUMENT', new Date(2026, 8, 25, 22, 54))).toBeNull();
    expect(findDraftError(today, 'DOCUMENT', new Date(2026, 8, 25, 22, 56))).toEqual(tooSoon);
    expect(findDraftError(today, 'DOCUMENT', new Date(2026, 8, 25, 23, 0))).toEqual(tooSoon);
  });

  it('ignores signer problems on the document step and reports them on the signers step', () => {
    const draft = pdfDraft({ signers: [{ ...ana, email: 'not-an-email' }] });

    expect(check(draft)).toBeNull();
    expect(check(draft, 'SIGNERS')).toEqual(
      expect.objectContaining({ details: { field: 'signers.email', reason: 'format', index: 0 } }),
    );
  });

  it('reports duplicate signers and missing WhatsApp numbers', () => {
    expect(check(pdfDraft({ signers: [ana, { ...ana, email: 'ANA@example.invalid' }] }), 'SIGNERS')).toEqual(
      expect.objectContaining({ details: { field: 'signers.email', reason: 'duplicate', index: 1 } }),
    );
    expect(
      check(
        pdfDraft({ signers: [{ ...ana, verificationMethod: 'Whatsapp', notificationMethod: 'Whatsapp' }] }),
        'SIGNERS',
      ),
    ).toEqual(expect.objectContaining({ details: { field: 'signers.phone', reason: 'required', index: 0 } }));
  });

  it('requires the certificate holder document', () => {
    expect(
      check(
        pdfDraft({ signers: [{ ...ana, verificationMethod: 'DigitalCertificate', governmentId: '123' }] }),
        'SIGNERS',
      ),
    ).toEqual(expect.objectContaining({ details: { field: 'signers.governmentId', reason: 'format', index: 0 } }));
  });

  it('rethrows unexpected errors', () => {
    const draft = pdfDraft();
    Object.defineProperty(draft, 'signers', {
      get: () => {
        throw new TypeError('boom');
      },
    });

    expect(() => check(draft)).toThrow('boom');
  });
});
