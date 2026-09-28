import { describe, expect, it } from 'vitest';

import {
  ANNEX_ID,
  CONTEXT,
  CONTRACT_ID,
  estimate,
  prepared,
  reviewState,
  summary,
} from 'src/front-components/utils/__tests__/send-flow-fixtures';
import { buildSignatureRequestInput } from 'src/front-components/utils/build-signature-request-input.util';
import { createSendFlowState } from 'src/front-components/utils/create-send-flow-state.util';
import { getErrorMessage } from 'src/front-components/utils/get-error-message.util';
import { getPrepareRequest } from 'src/front-components/utils/get-prepare-request.util';
import { sendFlowReducer } from 'src/front-components/utils/send-flow-reducer.util';
import { toSignerDraft } from 'src/front-components/utils/to-signer-draft.util';
import { type SendFlowAction } from 'src/types/send-flow-action';
import { type SendFlowState } from 'src/types/send-flow-state';

const run = (state: SendFlowState, ...actions: SendFlowAction[]): SendFlowState =>
  actions.reduce(sendFlowReducer, state);
const initial = () => createSendFlowState(CONTEXT);

describe('sendFlowReducer — draft edits', () => {
  it('invalidates the reviewed estimate and confirmation on any edit', () => {
    const state = run(reviewState({ confirmed: true }), {
      type: 'SET_TEXT',
      field: 'message',
      value: 'Hi',
    });

    expect(state).toMatchObject({ prepared: null, confirmed: false, requestId: null, error: null });
    expect(state.draft.message).toBe('Hi');
  });

  it('ignores edits while preparing', () => {
    const preparing = { ...initial(), preparing: true };

    expect(run(preparing, { type: 'SET_TEXT', field: 'name', value: 'X' })).toBe(preparing);
    expect(run(preparing, { type: 'GO_TO', step: 'SIGNERS' })).toBe(preparing);
  });

  it('names the document after the chosen attachment and follows a change of attachment', () => {
    const state = run(initial(), { type: 'SET_ATTACHMENT', attachmentId: ANNEX_ID });

    expect(state.draft).toMatchObject({ attachmentId: ANNEX_ID, name: 'Annex' });
    expect(run(state, { type: 'SET_ATTACHMENT', attachmentId: CONTRACT_ID }).draft.name).toBe('Contract');
    expect(run(state, { type: 'SET_ATTACHMENT', attachmentId: '' }).draft).toMatchObject({
      attachmentId: null,
      name: 'Annex',
    });
  });

  it('keeps a typed name when the attachment or template changes', () => {
    const typed = run(
      initial(),
      { type: 'SET_ATTACHMENT', attachmentId: ANNEX_ID },
      { type: 'SET_TEXT', field: 'name', value: 'Meu contrato' },
    );

    expect(run(typed, { type: 'SET_ATTACHMENT', attachmentId: CONTRACT_ID }).draft.name).toBe('Meu contrato');
    expect(run(typed, { type: 'SET_TEMPLATE', templateId: 'template-1' }).draft.name).toBe('Meu contrato');
  });

  it('keeps the name of an AI proposal', () => {
    const proposed = createSendFlowState(CONTEXT, {
      recordId: CONTEXT.record.id,
      source: null,
      name: 'Proposta',
      message: null,
      signers: [],
    });

    expect(run(proposed, { type: 'SET_ATTACHMENT', attachmentId: CONTRACT_ID }).draft.name).toBe('Proposta');
    expect(run(proposed, { type: 'SET_TEMPLATE', templateId: 'template-1' }).draft.name).toBe('Proposta');
  });

  it('replaces the name filled from the only PDF when a template is chosen, and back', () => {
    const single = createSendFlowState({ ...CONTEXT, attachments: [{ id: CONTRACT_ID, name: 'Contract.pdf' }] });
    const template = run(
      single,
      { type: 'SET_SOURCE_TYPE', sourceType: 'TEMPLATE' },
      { type: 'SET_TEMPLATE', templateId: 'template-1' },
    );

    expect(single.draft.name).toBe('Contract');
    expect(run(single, { type: 'SET_SOURCE_TYPE', sourceType: 'TEMPLATE' }).draft.name).toBe('Contract');
    expect(template.draft.name).toBe('NDA document');
    expect(run(template, { type: 'SET_SOURCE_TYPE', sourceType: 'PDF' }).draft.name).toBe('Contract');
  });

  it('follows a change of template', () => {
    const lease = { ...CONTEXT.templates[0]!, id: 'template-3', name: 'Lease', documentName: null };
    const twoTemplates = { ...CONTEXT, templates: [...CONTEXT.templates, lease] };
    const state = run(createSendFlowState(twoTemplates), { type: 'SET_TEMPLATE', templateId: 'template-1' });

    expect(run(state, { type: 'SET_TEMPLATE', templateId: 'template-3' }).draft.name).toBe('Lease');
  });

  it('moves signers still on the roles of another template onto the new template roles', () => {
    const lease = {
      id: 'template-3',
      name: 'Lease',
      documentName: null,
      signerRoles: [{ id: 'role-tenant', name: 'Tenant' }],
      editorFields: [],
      unsupportedReason: null,
    };
    const twoTemplates = { ...CONTEXT, templates: [CONTEXT.templates[0]!, lease] };
    const first = run(createSendFlowState(twoTemplates), { type: 'SET_TEMPLATE', templateId: 'template-1' });

    expect(
      run(first, { type: 'SET_TEMPLATE', templateId: 'template-3' }).draft.signers.map(({ name, roleId }) => [
        name,
        roleId,
      ]),
    ).toEqual([['Ana Lima', 'role-tenant']]);
  });

  it('turns signers into one group per template role and keeps editor values', () => {
    const state = run(
      initial(),
      { type: 'SET_TEMPLATE', templateId: 'template-1' },
      { type: 'SET_EDITOR_FIELD', fieldId: 'field-price', value: '100' },
    );

    expect(state.draft).toMatchObject({
      sourceType: 'TEMPLATE',
      templateId: 'template-1',
      name: 'NDA document',
      editorFields: { 'field-price': '100' },
    });
    expect(state.draft.signers.map(({ name, roleId }) => [name, roleId])).toEqual([
      ['Ana Lima', 'role-client'],
      ['', 'role-witness'],
    ]);
    expect(run(state, { type: 'SET_TEMPLATE', templateId: 'template-1' }).draft.editorFields).toEqual({
      'field-price': '100',
    });
  });

  it('keeps signers on their role when roles are reassigned', () => {
    const state = run(initial(), { type: 'SET_TEMPLATE', templateId: 'template-1' });
    const swapped = {
      ...state,
      draft: { ...state.draft, signers: state.draft.signers.toReversed() },
    };

    expect(
      run(swapped, { type: 'SET_SOURCE_TYPE', sourceType: 'TEMPLATE' }).draft.signers.map((signer) => signer.roleId),
    ).toEqual(['role-client', 'role-witness']);
  });

  it('uses the template name when it has no document name, and clears an unknown template', () => {
    const noDocumentName = { ...CONTEXT, templates: [{ ...CONTEXT.templates[0]!, documentName: null }] };
    const state = run(createSendFlowState(noDocumentName), { type: 'SET_TEMPLATE', templateId: 'template-1' });

    expect(state.draft.name).toBe('NDA');
    expect(run(state, { type: 'SET_TEMPLATE', templateId: 'missing' }).draft.templateId).toBeNull();
  });

  it('drops roles when switching back to a PDF, and leaves signers alone without a template', () => {
    const template = run(initial(), { type: 'SET_TEMPLATE', templateId: 'template-1' });

    expect(
      run(template, { type: 'SET_SOURCE_TYPE', sourceType: 'PDF' }).draft.signers.every(
        (signer) => signer.roleId === null,
      ),
    ).toBe(true);
    expect(run(initial(), { type: 'SET_SOURCE_TYPE', sourceType: 'TEMPLATE' }).draft.signers).toHaveLength(1);
  });

  it('couples the invitation channel to Email and WhatsApp verification', () => {
    const whatsapp = run(initial(), { type: 'SET_VERIFICATION', index: 0, method: 'Whatsapp' });

    expect(whatsapp.draft.signers[0]).toMatchObject({ verificationMethod: 'Whatsapp', notificationMethod: 'Whatsapp' });
    expect(run(whatsapp, { type: 'SET_NOTIFICATION', index: 0, method: 'Email' })).toBe(whatsapp);
  });

  it('lets a certificate signer keep and choose the channel', () => {
    const certificate = run(
      initial(),
      { type: 'SET_VERIFICATION', index: 0, method: 'Whatsapp' },
      { type: 'SET_VERIFICATION', index: 0, method: 'DigitalCertificate' },
    );

    expect(certificate.draft.signers[0]).toMatchObject({
      verificationMethod: 'DigitalCertificate',
      notificationMethod: 'Whatsapp',
    });
    expect(
      run(certificate, { type: 'SET_NOTIFICATION', index: 0, method: 'Email' }).draft.signers[0]?.notificationMethod,
    ).toBe('Email');
    expect(
      run(initial(), { type: 'SET_VERIFICATION', index: 5, method: 'DigitalCertificate' }).draft.signers,
    ).toHaveLength(1);
  });

  it('edits signer text and fills a signer from a contact', () => {
    const typed = run(initial(), { type: 'SET_SIGNER_TEXT', index: 0, field: 'governmentId', value: '123' });
    const state = run(typed, { type: 'FILL_SIGNER', index: 0, personId: 'person-bruno' });

    expect(typed.draft.signers[0]?.governmentId).toBe('123');
    expect(state.draft.signers[0]).toMatchObject({
      name: 'Bruno Reis',
      email: '',
      phone: '+15550100002',
      governmentId: '',
    });
    expect(run(state, { type: 'FILL_SIGNER', index: 0, personId: 'person-ana' }).draft.signers[0]?.email).toBe(
      'ana@example.invalid',
    );
    expect(run(state, { type: 'FILL_SIGNER', index: 0, personId: 'unknown' })).toBe(state);

    const withoutPhone = createSendFlowState({
      ...CONTEXT,
      additionalContacts: [{ personId: 'person-carla', name: 'Carla', email: 'carla@example.invalid', phone: null }],
    });
    expect(run(withoutPhone, { type: 'FILL_SIGNER', index: 0, personId: 'person-carla' }).draft.signers[0]?.phone).toBe(
      '',
    );
  });

  it("clears the previous person's CPF when a certificate signer is refilled from another contact", () => {
    const state = run(
      initial(),
      { type: 'SET_VERIFICATION', index: 0, method: 'DigitalCertificate' },
      { type: 'SET_SIGNER_TEXT', index: 0, field: 'governmentId', value: '52998224725' },
      { type: 'FILL_SIGNER', index: 0, personId: 'person-bruno' },
    );

    expect(state.draft.signers[0]).toMatchObject({ verificationMethod: 'DigitalCertificate', governmentId: '' });
    expect(buildSignatureRequestInput(state.draft, 'record', null).signers[0]?.governmentId).toBeNull();
  });

  it('adds and removes PDF signers within bounds', () => {
    const two = run(initial(), { type: 'ADD_SIGNER' });

    expect(two.draft.signers).toHaveLength(2);
    expect(run(two, { type: 'REMOVE_SIGNER', index: 0 }).draft.signers.map((signer) => signer.name)).toEqual(['']);

    const single = initial();
    expect(run(single, { type: 'REMOVE_SIGNER', index: 0 })).toBe(single);

    const full = {
      ...single,
      draft: { ...single.draft, signers: Array.from({ length: 20 }, () => toSignerDraft(null)) },
    };
    expect(run(full, { type: 'ADD_SIGNER' })).toBe(full);
  });

  it('keeps template groups fixed', () => {
    const template = run(initial(), { type: 'SET_TEMPLATE', templateId: 'template-1' });

    expect(run(template, { type: 'ADD_SIGNER' })).toBe(template);
    expect(run(template, { type: 'REMOVE_SIGNER', index: 0 })).toBe(template);
  });

  it('toggles the signing order', () => {
    expect(run(initial(), { type: 'TOGGLE_SEQUENTIAL' }).draft.sequential).toBe(true);
  });
});

describe('sendFlowReducer — navigation and prepare', () => {
  const invalid = { code: 'INVALID_INPUT' as const, message: '', details: { field: 'name', reason: 'required' } };

  it('moves between steps and clears errors', () => {
    const state = run(initial(), { type: 'SHOW_ERROR', error: invalid });

    expect(state.error).toEqual(invalid);
    expect(run(state, { type: 'GO_TO', step: 'SIGNERS' })).toMatchObject({ step: 'SIGNERS', error: null });
  });

  it('opens the review with an unchecked confirmation and remembers the PDF upload', () => {
    const state = run(initial(), { type: 'SET_ATTACHMENT', attachmentId: CONTRACT_ID }, { type: 'PREPARE_STARTED' });

    expect(state).toMatchObject({ preparing: true, error: null });

    const reviewed = run(state, { type: 'PREPARE_SUCCEEDED', prepared: prepared() });

    expect(reviewed).toMatchObject({ step: 'REVIEW', preparing: false, confirmed: false });
    expect(reviewed.upload).toEqual({
      assinafyDocumentId: 'doc-1',
      accountId: 'account-1',
      attachmentId: CONTRACT_ID,
      name: 'Contract',
      sendAttempted: false,
    });
  });

  it('keeps the send attempt mark when the same upload is estimated again', () => {
    const attempted = reviewState({ upload: { ...reviewState().upload!, sendAttempted: true } });

    expect(
      run(attempted, { type: 'PREPARE_STARTED' }, { type: 'PREPARE_SUCCEEDED', prepared: prepared() }).upload
        ?.sendAttempted,
    ).toBe(true);
    expect(
      run(
        attempted,
        { type: 'PREPARE_STARTED' },
        { type: 'PREPARE_SUCCEEDED', prepared: prepared({ assinafyDocumentId: 'doc-2' }) },
      ).upload?.sendAttempted,
    ).toBe(false);
  });

  it('forgets an upload that no longer matches when preparing again', () => {
    const renamed = run(
      reviewState(),
      { type: 'SET_TEXT', field: 'name', value: 'Renamed' },
      { type: 'PREPARE_STARTED' },
    );

    expect(renamed.upload).toBeNull();
  });

  it('has no upload for templates', () => {
    const template = run(initial(), { type: 'SET_TEMPLATE', templateId: 'template-1' }, { type: 'PREPARE_STARTED' });

    expect(
      run(template, { type: 'PREPARE_SUCCEEDED', prepared: prepared({ assinafyDocumentId: null }) }).upload,
    ).toBeNull();
  });

  it('keeps the request id when the same draft is estimated again', () => {
    const retrying = reviewState({ requestId: 'request-1' });

    expect(
      run(retrying, { type: 'PREPARE_STARTED' }, { type: 'PREPARE_SUCCEEDED', prepared: prepared() }).requestId,
    ).toBe('request-1');
  });

  it('keeps the upload of a prepare that failed after uploading, so the next prepare reuses it', () => {
    const unavailable = {
      code: 'PROVIDER_UNAVAILABLE' as const,
      message: '',
      details: { assinafyDocumentId: 'doc-9', accountId: 'account-1' },
    };
    const failed = run(
      initial(),
      { type: 'SET_ATTACHMENT', attachmentId: CONTRACT_ID },
      { type: 'PREPARE_STARTED' },
      { type: 'PREPARE_FAILED', error: unavailable },
    );

    expect(failed.upload).toEqual({
      assinafyDocumentId: 'doc-9',
      accountId: 'account-1',
      attachmentId: CONTRACT_ID,
      name: 'Contract',
      sendAttempted: false,
    });
    expect(getPrepareRequest(failed).body.assinafyDocumentId).toBe('doc-9');
  });

  it('keeps the current upload when a failed prepare returns none, and needs an attachment to keep one', () => {
    const reused = run(reviewState(), { type: 'PREPARE_STARTED' }, { type: 'PREPARE_FAILED', error: invalid });

    expect(reused.upload?.assinafyDocumentId).toBe('doc-1');
    expect(
      run(
        reviewState(),
        { type: 'PREPARE_STARTED' },
        { type: 'PREPARE_FAILED', error: { ...invalid, details: { assinafyDocumentId: 'doc-9' } } },
      ).upload,
    ).toEqual(reviewState().upload);
    expect(
      run(
        initial(),
        { type: 'PREPARE_STARTED' },
        { type: 'PREPARE_FAILED', error: { ...invalid, details: { assinafyDocumentId: 'doc-9', accountId: 'a' } } },
      ).upload,
    ).toBeNull();
  });

  it.each(['NOT_FOUND', 'INVALID_STATE'] as const)(
    'drops an upload the server rejected with %s so the next prepare uploads again',
    (code) => {
      const rejected = run(reviewState(), { type: 'PREPARE_STARTED' }, { type: 'PREPARE_FAILED', error: { code, message: '' } });

      expect(rejected.upload).toBeNull();
      expect(getPrepareRequest(rejected).body.assinafyDocumentId).toBeNull();
    },
  );

  it('reports a failed prepare and unlocks the draft', () => {
    expect(run({ ...initial(), preparing: true }, { type: 'PREPARE_FAILED', error: invalid })).toMatchObject({
      preparing: false,
      error: invalid,
    });
  });

  it('toggles the confirmation on the review step only', () => {
    expect(run(reviewState(), { type: 'TOGGLE_CONFIRMED' }).confirmed).toBe(true);

    const document = initial();
    expect(run(document, { type: 'TOGGLE_CONFIRMED' })).toBe(document);
  });
});

const sending = () => run(reviewState({ confirmed: true }), { type: 'SEND_STARTED', requestId: 'request-1' });

describe('sendFlowReducer — send', () => {
  it('records the request id and marks the upload as possibly assigned', () => {
    expect(sending()).toMatchObject({ step: 'SENDING', requestId: 'request-1', upload: { sendAttempted: true } });
    expect(run(reviewState({ upload: null }), { type: 'SEND_STARTED', requestId: 'request-1' }).upload).toBeNull();
  });

  it('finishes with the document summary', () => {
    expect(run(sending(), { type: 'SEND_SUCCEEDED', summary: summary() })).toMatchObject({
      step: 'DONE',
      result: summary(),
      error: null,
    });
  });

  it('does not report an attempt that is still sending as sent', () => {
    expect(run(sending(), { type: 'SEND_SUCCEEDED', summary: summary({ status: 'SENDING' }) })).toMatchObject({
      step: 'ERROR',
      result: summary({ status: 'SENDING' }),
      error: { code: 'UNCERTAIN' },
    });
  });

  it('stops for good on an uncertain outcome', () => {
    expect(run(sending(), { type: 'SEND_FAILED', error: { code: 'UNCERTAIN', message: '' } })).toMatchObject({
      step: 'ERROR',
      error: { code: 'UNCERTAIN' },
    });
    expect(run(sending(), { type: 'SEND_SUCCEEDED', summary: summary({ status: 'UNCERTAIN' }) })).toMatchObject({
      step: 'ERROR',
      error: { code: 'UNCERTAIN' },
    });
  });

  it('keeps the request id and confirmation when the outcome is unknown', () => {
    expect(run(sending(), { type: 'SEND_FAILED', error: { code: 'INTERNAL', message: '' } })).toMatchObject({
      step: 'REVIEW',
      requestId: 'request-1',
      confirmed: true,
      error: { code: 'INTERNAL' },
    });
  });

  it('locks the draft after an unknown outcome, so no edit can mint a second request id', () => {
    const unknown = run(sending(), { type: 'SEND_FAILED', error: { code: 'INTERNAL', message: '' } });
    const reestimated = run(unknown, { type: 'PREPARE_STARTED' });

    for (const state of [unknown, reestimated]) {
      expect(run(state, { type: 'GO_TO', step: 'SIGNERS' })).toBe(state);
      expect(run(state, { type: 'SET_SIGNER_TEXT', index: 0, field: 'name', value: 'Bia' })).toBe(state);
      expect(run(state, { type: 'TOGGLE_SEQUENTIAL' })).toBe(state);
    }

    expect(
      run(reestimated, { type: 'PREPARE_SUCCEEDED', prepared: prepared() }, { type: 'SET_TEXT', field: 'name', value: 'X' }),
    ).toMatchObject({ step: 'REVIEW', requestId: 'request-1', draft: { name: unknown.draft.name } });
  });

  it('replaces the request id after a definitive failure', () => {
    expect(
      run(sending(), { type: 'SEND_FAILED', error: { code: 'PROVIDER_REJECTED', message: 'Plano' } }),
    ).toMatchObject({
      step: 'REVIEW',
      requestId: null,
      confirmed: false,
      prepared: prepared(),
    });
  });

  it('treats a retry answered with a failed record as definitive', () => {
    expect(
      run(sending(), { type: 'SEND_SUCCEEDED', summary: summary({ status: 'FAILED', lastError: 'COST_CHANGED' }) }),
    ).toMatchObject({
      step: 'REVIEW',
      requestId: null,
      confirmed: false,
      error: { code: 'COST_CHANGED' },
    });
    expect(run(sending(), { type: 'SEND_SUCCEEDED', summary: summary({ status: 'FAILED' }) }).error?.code).toBe(
      'INTERNAL',
    );
  });

  it('shows why a retry answered with a record the sync marked NOT_SENT can be sent again', () => {
    const state = run(sending(), {
      type: 'SEND_SUCCEEDED',
      summary: summary({ status: 'FAILED', lastError: 'NOT_SENT' }),
    });

    expect(state).toMatchObject({ step: 'REVIEW', requestId: null, confirmed: false });
    expect(getErrorMessage(state.error!).message.message).toBe(
      'A Assinafy confirmou que a tentativa anterior não foi enviada. Confirme e envie novamente.',
    );
  });

  it('returns to the review with the new estimate after a cost change', () => {
    const fresh = estimate({ totalCredits: 1.45 });
    const state = run(sending(), {
      type: 'SEND_FAILED',
      error: { code: 'COST_CHANGED', message: '', details: { estimate: fresh } },
    });

    expect(state).toMatchObject({ step: 'REVIEW', confirmed: false, requestId: null, prepared: { estimate: fresh } });
  });

  it('shows the blocking estimate when resources ran out', () => {
    const blocked = estimate({ sufficient: false, blockingReason: 'InsufficientCredits' });

    expect(
      run(sending(), {
        type: 'SEND_FAILED',
        error: { code: 'INSUFFICIENT_RESOURCES', message: '', details: { estimate: blocked } },
      }).prepared?.estimate,
    ).toEqual(blocked);
  });

  it('ignores a malformed estimate in the error details', () => {
    expect(
      run(sending(), {
        type: 'SEND_FAILED',
        error: { code: 'COST_CHANGED', message: '', details: { estimate: { total: 1 } } },
      }).prepared,
    ).toEqual(prepared());
  });
});
