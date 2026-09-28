import { MAX_SIGNERS } from 'src/constants/limits';
import { getReusableUploadId } from 'src/front-components/utils/get-reusable-upload-id.util';
import { toSignerDraft } from 'src/front-components/utils/to-signer-draft.util';
import { type AppError } from 'src/types/app-error';
import { type AppErrorCode } from 'src/types/app-error-code';
import { type CostEstimate } from 'src/types/cost-estimate';
import { type DocumentSummary } from 'src/types/document-summary';
import { type SendFlowAction } from 'src/types/send-flow-action';
import { type SendFlowDraft } from 'src/types/send-flow-draft';
import { type SendFlowState } from 'src/types/send-flow-state';
import { type SignatureContext } from 'src/types/signature-context';
import { type SignerDraft } from 'src/types/signer-draft';
import { type TemplateSummary } from 'src/types/template-summary';

// The draft is locked while preparing, and once a send left a request id without a known outcome: only a retry with
// that id can return the document it may have created, so the flow allows no edit that would need a new one.
const isDraftLocked = (state: SendFlowState): boolean => state.preparing || state.requestId !== null;

// Any edit invalidates the reviewed estimate and its confirmation.
const editDraft = (state: SendFlowState, draft: SendFlowDraft): SendFlowState =>
  isDraftLocked(state) ? state : { ...state, draft, error: null, prepared: null, confirmed: false };

const updateSigner = (state: SendFlowState, index: number, patch: Partial<SignerDraft>): SendFlowState =>
  editDraft(state, {
    ...state.draft,
    signers: state.draft.signers.map((signer, position) => (position === index ? { ...signer, ...patch } : signer)),
  });

// One fixed signer per template signer role: a signer already on the role keeps it, the others fill roles in order.
const assignRoles = (signers: SignerDraft[], template: TemplateSummary): SignerDraft[] => {
  const roleIds = new Set(template.signerRoles.map((role) => role.id));
  const unassigned = signers.filter((signer) => signer.roleId === null || !roleIds.has(signer.roleId));

  return template.signerRoles.map((role) => ({
    ...(signers.find((signer) => signer.roleId === role.id) ?? unassigned.shift() ?? toSignerDraft(null)),
    roleId: role.id,
  }));
};

// The name the flow gives a draft's selected attachment or template; null when nothing is selected.
const defaultName = (
  { sourceType, attachmentId, templateId }: Pick<SendFlowDraft, 'sourceType' | 'attachmentId' | 'templateId'>,
  context: SignatureContext,
): string | null => {
  if (sourceType === 'PDF') {
    const attachment = context.attachments.find((candidate) => candidate.id === attachmentId);

    return attachment ? attachment.name.replace(/\.pdf$/i, '') : null;
  }

  const template = context.templates.find((candidate) => candidate.id === templateId);

  return template ? (template.documentName ?? template.name) : null;
};

// A blank name, or one the flow filled from the selected attachment or template, follows the next selection; a name
// the member typed or an AI proposal set is kept.
const withDefaultName = (draft: SendFlowDraft, next: SendFlowDraft, context: SignatureContext): SendFlowDraft => {
  const filled =
    draft.name.trim() === '' ||
    draft.name === defaultName({ ...draft, sourceType: 'PDF' }, context) ||
    draft.name === defaultName({ ...draft, sourceType: 'TEMPLATE' }, context);
  const name = defaultName(next, context);

  return filled && name !== null ? { ...next, name } : next;
};

const isCostEstimate = (value: unknown): value is CostEstimate =>
  typeof value === 'object' && value !== null && typeof (value as CostEstimate).totalCredits === 'number';

// The PDF a prepare uploaded, reused while its attachment and name are unchanged.
const rememberUpload = (state: SendFlowState, assinafyDocumentId: string, accountId: string): SendFlowState['upload'] =>
  state.draft.attachmentId === null
    ? null
    : {
        assinafyDocumentId,
        accountId,
        attachmentId: state.draft.attachmentId,
        name: state.draft.name.trim(),
        sendAttempted: state.upload?.assinafyDocumentId === assinafyDocumentId && state.upload.sendAttempted,
      };

const settleSend = (state: SendFlowState, summary: DocumentSummary): SendFlowState => {
  // A retry answered with an attempt that is still running, or never settled, is not a confirmed send.
  if (summary.status === 'UNCERTAIN' || summary.status === 'SENDING') {
    return { ...state, step: 'ERROR', result: summary, error: { code: 'UNCERTAIN', message: '' } };
  }

  // A retry answered with the record of an earlier attempt that failed: its key is spent.
  if (summary.status === 'FAILED') {
    return {
      ...state,
      step: 'REVIEW',
      confirmed: false,
      requestId: null,
      // lastError holds the AppErrorCode the send failed with, or NOT_SENT when the sync confirmed an unconfirmed send
      // never went out; unknown codes display as INTERNAL.
      error: { code: (summary.lastError ?? 'INTERNAL') as AppErrorCode, message: '' },
    };
  }

  return { ...state, step: 'DONE', result: summary, error: null };
};

const failSend = (state: SendFlowState, error: AppError): SendFlowState => {
  if (error.code === 'UNCERTAIN') {
    return { ...state, step: 'ERROR', error };
  }

  // No envelope proves the server saw the request: keep the key so a retry returns the document instead of a resend.
  if (error.code === 'INTERNAL') {
    return { ...state, step: 'REVIEW', error };
  }

  const estimate = error.details?.estimate;

  return {
    ...state,
    step: 'REVIEW',
    error,
    confirmed: false,
    requestId: null,
    prepared: state.prepared && isCostEstimate(estimate) ? { ...state.prepared, estimate } : state.prepared,
  };
};

export const sendFlowReducer = (state: SendFlowState, action: SendFlowAction): SendFlowState => {
  const { draft, context } = state;

  switch (action.type) {
    case 'SET_SOURCE_TYPE': {
      const template = context.templates.find((candidate) => candidate.id === draft.templateId);

      return editDraft(
        state,
        withDefaultName(
          draft,
          {
            ...draft,
            sourceType: action.sourceType,
            signers:
              action.sourceType === 'TEMPLATE' && template
                ? assignRoles(draft.signers, template)
                : draft.signers.map((signer) => ({ ...signer, roleId: null })),
          },
          context,
        ),
      );
    }
    case 'SET_ATTACHMENT': {
      const attachment = context.attachments.find((candidate) => candidate.id === action.attachmentId);

      return editDraft(state, withDefaultName(draft, { ...draft, attachmentId: attachment?.id ?? null }, context));
    }
    case 'SET_TEMPLATE': {
      const template = context.templates.find((candidate) => candidate.id === action.templateId);

      if (!template) {
        return editDraft(state, { ...draft, templateId: null });
      }

      return editDraft(
        state,
        withDefaultName(
          draft,
          {
            ...draft,
            sourceType: 'TEMPLATE',
            templateId: template.id,
            editorFields: Object.fromEntries(
              template.editorFields.map(({ fieldId }) => [fieldId, draft.editorFields[fieldId] ?? '']),
            ),
            signers: assignRoles(draft.signers, template),
          },
          context,
        ),
      );
    }
    case 'SET_EDITOR_FIELD':
      return editDraft(state, { ...draft, editorFields: { ...draft.editorFields, [action.fieldId]: action.value } });
    case 'SET_TEXT':
      return editDraft(state, { ...draft, [action.field]: action.value });
    case 'TOGGLE_SEQUENTIAL':
      return editDraft(state, { ...draft, sequential: !draft.sequential });
    case 'SET_SIGNER_TEXT':
      return updateSigner(state, action.index, { [action.field]: action.value });
    case 'SET_VERIFICATION':
      // Assinafy pairs Email and WhatsApp verification with the same channel; a certificate keeps the chosen one.
      return updateSigner(state, action.index, {
        verificationMethod: action.method,
        notificationMethod:
          action.method === 'DigitalCertificate'
            ? (draft.signers[action.index]?.notificationMethod ?? 'Email')
            : action.method,
      });
    case 'SET_NOTIFICATION':
      return draft.signers[action.index]?.verificationMethod === 'DigitalCertificate'
        ? updateSigner(state, action.index, { notificationMethod: action.method })
        : state;
    case 'FILL_SIGNER': {
      const contact = [...context.suggestedSigners, ...context.additionalContacts].find(
        (candidate) => candidate.personId === action.personId,
      );

      // A fill replaces the person in the slot, so the previous person's CPF/CNPJ goes too (contacts carry none).
      return contact
        ? updateSigner(state, action.index, {
            name: contact.name,
            email: contact.email ?? '',
            phone: contact.phone ?? '',
            governmentId: '',
          })
        : state;
    }
    case 'ADD_SIGNER':
      return draft.sourceType === 'PDF' && draft.signers.length < MAX_SIGNERS
        ? editDraft(state, { ...draft, signers: [...draft.signers, toSignerDraft(null)] })
        : state;
    case 'REMOVE_SIGNER':
      return draft.sourceType === 'PDF' && draft.signers.length > 1
        ? editDraft(state, { ...draft, signers: draft.signers.filter((_, position) => position !== action.index) })
        : state;
    case 'GO_TO':
      return isDraftLocked(state) ? state : { ...state, step: action.step, error: null };
    case 'SHOW_ERROR':
      return { ...state, error: action.error };
    case 'PREPARE_STARTED':
      return {
        ...state,
        preparing: true,
        error: null,
        upload: getReusableUploadId(state) === null ? null : state.upload,
      };
    case 'PREPARE_SUCCEEDED': {
      const { prepared } = action;

      return {
        ...state,
        step: 'REVIEW',
        preparing: false,
        prepared,
        confirmed: false,
        upload:
          prepared.assinafyDocumentId === null
            ? null
            : rememberUpload(state, prepared.assinafyDocumentId, prepared.accountId),
      };
    }
    case 'PREPARE_FAILED': {
      // A prepare that failed after uploading the PDF returns the upload, so the next attempt reuses it; an upload the
      // server no longer accepts (gone, another workspace, already sent) is dropped so the next attempt uploads again.
      const { assinafyDocumentId, accountId } = action.error.details ?? {};
      const rejectedUpload = action.error.code === 'NOT_FOUND' || action.error.code === 'INVALID_STATE';

      return {
        ...state,
        preparing: false,
        error: action.error,
        upload:
          typeof assinafyDocumentId === 'string' && typeof accountId === 'string'
            ? rememberUpload(state, assinafyDocumentId, accountId)
            : rejectedUpload
              ? null
              : state.upload,
      };
    }
    case 'TOGGLE_CONFIRMED':
      return state.step === 'REVIEW' ? { ...state, confirmed: !state.confirmed } : state;
    case 'SEND_STARTED':
      return {
        ...state,
        step: 'SENDING',
        requestId: action.requestId,
        error: null,
        upload: state.upload && { ...state.upload, sendAttempted: true },
      };
    case 'SEND_SUCCEEDED':
      return settleSend(state, action.summary);
    case 'SEND_FAILED':
      return failSend(state, action.error);
  }
};
