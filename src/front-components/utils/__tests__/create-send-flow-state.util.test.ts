import { describe, expect, it } from 'vitest';

import { CONTEXT, CONTRACT_ID } from 'src/front-components/utils/__tests__/send-flow-fixtures';
import { createSendFlowState } from 'src/front-components/utils/create-send-flow-state.util';
import { type SignatureRequestProposal } from 'src/types/signature-request-proposal';

const proposal = (overrides: Partial<SignatureRequestProposal> = {}): SignatureRequestProposal => ({
  recordId: CONTEXT.record.id,
  source: null,
  name: null,
  message: null,
  signers: [],
  ...overrides,
});

describe('createSendFlowState', () => {
  it('opens a PDF flow with the suggested signers and no selection when several PDFs exist', () => {
    const state = createSendFlowState(CONTEXT);

    expect(state).toMatchObject({ step: 'DOCUMENT', preparing: false, prepared: null, requestId: null, upload: null });
    expect(state.draft).toMatchObject({ sourceType: 'PDF', attachmentId: null, name: '', sequential: false });
    expect(state.draft.signers.map((signer) => signer.name)).toEqual(['Ana Lima']);
  });

  it('preselects the only PDF', () => {
    expect(
      createSendFlowState({ ...CONTEXT, attachments: [{ id: CONTRACT_ID, name: 'Contract.pdf' }] }).draft,
    ).toMatchObject({
      attachmentId: CONTRACT_ID,
      name: 'Contract',
    });
  });

  it('starts on templates when the record has no PDF, and with one blank signer without suggestions', () => {
    const state = createSendFlowState({ ...CONTEXT, attachments: [], suggestedSigners: [] });

    expect(state.draft.sourceType).toBe('TEMPLATE');
    expect(state.draft.signers).toHaveLength(1);
    expect(createSendFlowState({ ...CONTEXT, attachments: [], templates: [] }).draft.sourceType).toBe('PDF');
    // Only unsupported templates: nothing to pick on the template side.
    const unsupportedOnly = { ...CONTEXT, attachments: [], templates: [CONTEXT.templates[1]!] };
    expect(createSendFlowState(unsupportedOnly).draft.sourceType).toBe('PDF');
  });

  it('caps suggested signers at the signer limit', () => {
    const suggestedSigners = Array.from({ length: 25 }, (_, index) => ({
      personId: `person-${index}`,
      name: `Person ${index}`,
      email: `person-${index}@example.invalid`,
      phone: null,
    }));

    expect(createSendFlowState({ ...CONTEXT, suggestedSigners }).draft.signers).toHaveLength(20);
  });

  it('prefills a PDF proposal', () => {
    const state = createSendFlowState(
      CONTEXT,
      proposal({
        source: { type: 'PDF', attachmentId: CONTRACT_ID },
        name: 'Proposal',
        message: 'Please sign',
        signers: [
          {
            name: 'Carla',
            email: null,
            phone: '+15550100003',
            verificationMethod: 'Whatsapp',
            notificationMethod: 'Whatsapp',
            governmentId: null,
            roleId: null,
          },
        ],
      }),
    );

    expect(state.draft).toMatchObject({
      sourceType: 'PDF',
      attachmentId: CONTRACT_ID,
      name: 'Proposal',
      message: 'Please sign',
    });
    expect(state.draft.signers).toEqual([
      expect.objectContaining({ name: 'Carla', verificationMethod: 'Whatsapp', phone: '+15550100003' }),
    ]);
  });

  it('prefills a template proposal with its roles and editor fields', () => {
    const state = createSendFlowState(
      CONTEXT,
      proposal({
        source: {
          type: 'TEMPLATE',
          templateId: 'template-1',
          editorFields: [{ fieldId: 'field-price', value: '100' }],
        },
        signers: [
          {
            name: 'Witness',
            email: 'witness@example.invalid',
            phone: null,
            verificationMethod: 'Email',
            notificationMethod: 'Email',
            governmentId: null,
            roleId: 'role-witness',
          },
        ],
      }),
    );

    expect(state.draft).toMatchObject({
      sourceType: 'TEMPLATE',
      templateId: 'template-1',
      editorFields: { 'field-price': '100' },
    });
    expect(state.draft.signers.map(({ name, roleId }) => [name, roleId])).toEqual([
      ['', 'role-client'],
      ['Witness', 'role-witness'],
    ]);
  });

  it('falls back to suggested signers for a proposal without signers', () => {
    expect(createSendFlowState(CONTEXT, proposal()).draft.signers.map((signer) => signer.name)).toEqual(['Ana Lima']);
  });
});
