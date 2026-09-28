import { type SendFlowDraft } from 'src/types/send-flow-draft';
import { type SignatureRequestInput } from 'src/types/signature-request-input';
import { type SignerDraft } from 'src/types/signer-draft';
import { type SignerInput } from 'src/types/signer-input';
import { normalizeGovernmentId } from 'src/utils/normalize-government-id.util';
import { normalizePhone } from 'src/utils/normalize-phone.util';
import { requiresSigningOrder } from 'src/utils/requires-signing-order.util';

const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

// Signers can sign until the end of the chosen day, in the browser's time zone. Whole seconds: a provider that rounded
// milliseconds could otherwise move the deadline to the next day.
const toDeadline = (expiresOn: string): string | null => {
  const match = DATE_INPUT_PATTERN.exec(expiresOn);

  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 23, 59, 59).toISOString() : null;
};

const toSignerInput = (signer: SignerDraft): SignerInput => {
  const phone = signer.phone.trim();
  const governmentId = signer.governmentId.trim();

  return {
    name: signer.name.trim(),
    email: signer.email.trim() || null,
    // Assinafy only receives the phone of a WhatsApp invitation, so a stale CRM phone never blocks an email signer.
    phone: signer.notificationMethod === 'Whatsapp' && phone ? (normalizePhone(phone) ?? phone) : null,
    verificationMethod: signer.verificationMethod,
    notificationMethod: signer.notificationMethod,
    governmentId:
      signer.verificationMethod === 'DigitalCertificate' && governmentId
        ? (normalizeGovernmentId(governmentId) ?? governmentId)
        : null,
    roleId: signer.roleId,
  };
};

// Invalid values are passed through as typed so the shared validators report them.
export const buildSignatureRequestInput = (
  draft: SendFlowDraft,
  recordId: string,
  assinafyDocumentId: string | null,
): SignatureRequestInput => {
  const signers = draft.signers.map(toSignerInput);

  return {
    recordId,
    source:
      draft.sourceType === 'PDF'
        ? { type: 'PDF', attachmentId: draft.attachmentId ?? '' }
        : {
            type: 'TEMPLATE',
            templateId: draft.templateId ?? '',
            editorFields: Object.entries(draft.editorFields).map(([fieldId, value]) => ({
              fieldId,
              value: value.trim(),
            })),
          },
    name: draft.name.trim(),
    signers,
    message: draft.message.trim() || null,
    expiresAt: toDeadline(draft.expiresOn),
    sequential: draft.sequential || requiresSigningOrder(signers),
    assinafyDocumentId: draft.sourceType === 'PDF' ? assinafyDocumentId : null,
  };
};
