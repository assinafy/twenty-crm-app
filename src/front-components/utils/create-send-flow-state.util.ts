import { MAX_SIGNERS } from 'src/constants/limits';
import { sendFlowReducer } from 'src/front-components/utils/send-flow-reducer.util';
import { toSignerDraft } from 'src/front-components/utils/to-signer-draft.util';
import { type SendFlowState } from 'src/types/send-flow-state';
import { type SignatureContext } from 'src/types/signature-context';
import { type SignatureRequestProposal } from 'src/types/signature-request-proposal';

// Opens the flow on the Document step, prefilled from the record's suggested signers or from an AI proposal.
export const createSendFlowState = (
  context: SignatureContext,
  proposal: SignatureRequestProposal | null = null,
): SendFlowState => {
  const source = proposal?.source ?? null;
  const signers =
    proposal && proposal.signers.length > 0
      ? proposal.signers.map((signer) => toSignerDraft(signer, signer.roleId))
      : context.suggestedSigners.map((contact) => toSignerDraft(contact));
  const hasTemplates = context.templates.some((template) => template.unsupportedReason === null);
  const state: SendFlowState = {
    step: 'DOCUMENT',
    context,
    draft: {
      sourceType: source?.type ?? (context.attachments.length === 0 && hasTemplates ? 'TEMPLATE' : 'PDF'),
      attachmentId: null,
      templateId: null,
      editorFields:
        source?.type === 'TEMPLATE'
          ? Object.fromEntries(source.editorFields.map(({ fieldId, value }) => [fieldId, value]))
          : {},
      name: proposal?.name ?? '',
      message: proposal?.message ?? '',
      expiresOn: '',
      sequential: false,
      signers: signers.length > 0 ? signers.slice(0, MAX_SIGNERS) : [toSignerDraft(null)],
    },
    preparing: false,
    error: null,
    prepared: null,
    confirmed: false,
    requestId: null,
    upload: null,
    result: null,
  };

  if (source?.type === 'TEMPLATE') {
    return sendFlowReducer(state, { type: 'SET_TEMPLATE', templateId: source.templateId });
  }

  const attachmentId =
    source?.type === 'PDF' ? source.attachmentId : context.attachments.length === 1 ? context.attachments[0]?.id : null;

  // An attachment is only picked for a PDF draft: one attachment, or a PDF proposal, always opens on PDF.
  return attachmentId ? sendFlowReducer(state, { type: 'SET_ATTACHMENT', attachmentId }) : state;
};
