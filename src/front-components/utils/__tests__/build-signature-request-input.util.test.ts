import { describe, expect, it } from 'vitest';

import { buildSignatureRequestInput } from 'src/front-components/utils/build-signature-request-input.util';
import { toSignerDraft } from 'src/front-components/utils/to-signer-draft.util';
import { type SendFlowDraft } from 'src/types/send-flow-draft';

const draft = (overrides: Partial<SendFlowDraft> = {}): SendFlowDraft => ({
  sourceType: 'PDF',
  attachmentId: 'attachment-1',
  templateId: 'template-1',
  editorFields: { 'field-1': ' 100 ' },
  name: '  Contract ',
  message: '   ',
  expiresOn: '',
  sequential: false,
  signers: [{ ...toSignerDraft(null), name: ' Ana ', email: ' ana@example.invalid ', phone: '+1 (555) 010-0001' }],
  ...overrides,
});

describe('buildSignatureRequestInput', () => {
  it('builds a trimmed PDF request and drops the phone of an email signer', () => {
    expect(buildSignatureRequestInput(draft(), 'record-1', 'doc-1')).toEqual({
      recordId: 'record-1',
      source: { type: 'PDF', attachmentId: 'attachment-1' },
      name: 'Contract',
      signers: [
        {
          name: 'Ana',
          email: 'ana@example.invalid',
          phone: null,
          verificationMethod: 'Email',
          notificationMethod: 'Email',
          governmentId: null,
          roleId: null,
        },
      ],
      message: null,
      expiresAt: null,
      sequential: false,
      assinafyDocumentId: 'doc-1',
    });
  });

  it('builds a template request without an upload id', () => {
    const input = buildSignatureRequestInput(
      draft({ sourceType: 'TEMPLATE', message: ' Hello ', sequential: true }),
      'record-1',
      'doc-1',
    );

    expect(input.source).toEqual({
      type: 'TEMPLATE',
      templateId: 'template-1',
      editorFields: [{ fieldId: 'field-1', value: '100' }],
    });
    expect(input.message).toBe('Hello');
    expect(input.sequential).toBe(true);
    expect(input.assinafyDocumentId).toBeNull();
  });

  it('sends empty ids for a missing selection so the validators report them', () => {
    expect(buildSignatureRequestInput(draft({ attachmentId: null }), 'r', null).source).toEqual({
      type: 'PDF',
      attachmentId: '',
    });
    expect(
      buildSignatureRequestInput(draft({ sourceType: 'TEMPLATE', templateId: null }), 'r', null).source,
    ).toMatchObject({
      templateId: '',
    });
  });

  it('normalizes a WhatsApp phone and keeps an invalid one as typed', () => {
    const whatsapp = {
      ...toSignerDraft(null),
      name: 'Ana',
      verificationMethod: 'Whatsapp' as const,
      notificationMethod: 'Whatsapp' as const,
    };

    expect(
      buildSignatureRequestInput(draft({ signers: [{ ...whatsapp, phone: '+1 (555) 010-0001' }] }), 'r', null)
        .signers[0]?.phone,
    ).toBe('+15550100001');
    expect(
      buildSignatureRequestInput(draft({ signers: [{ ...whatsapp, phone: '5550100' }] }), 'r', null).signers[0]?.phone,
    ).toBe('5550100');
    expect(
      buildSignatureRequestInput(draft({ signers: [{ ...whatsapp, phone: ' ' }] }), 'r', null).signers[0]?.phone,
    ).toBeNull();
  });

  it('keeps the government id only for certificate signers and forces the signing order', () => {
    const certificate = {
      ...toSignerDraft(null),
      verificationMethod: 'DigitalCertificate' as const,
      governmentId: '123.456.789-01',
    };
    const input = buildSignatureRequestInput(
      draft({ signers: [certificate, { ...certificate, governmentId: '12' }, { ...certificate, governmentId: '' }] }),
      'r',
      null,
    );

    expect(input.signers.map((signer) => signer.governmentId)).toEqual(['12345678901', '12', null]);
    expect(input.sequential).toBe(true);
    expect(
      buildSignatureRequestInput(
        draft({ signers: [{ ...toSignerDraft(null), governmentId: '12345678901' }] }),
        'r',
        null,
      ).signers[0]?.governmentId,
    ).toBeNull();
  });

  it('turns the deadline date into the end of that local day', () => {
    const expiresAt = buildSignatureRequestInput(draft({ expiresOn: '2026-10-01' }), 'r', null).expiresAt;

    expect(expiresAt).toBe(new Date(2026, 9, 1, 23, 59, 59).toISOString());
    expect(new Date(2026, 9, 2).getTime() - Date.parse(expiresAt ?? '')).toBe(1000);
    expect(buildSignatureRequestInput(draft({ expiresOn: '01/10/2026' }), 'r', null).expiresAt).toBeNull();
  });
});
