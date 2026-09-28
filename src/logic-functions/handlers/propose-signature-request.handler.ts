import { findContacts } from 'src/data/find-contacts';
import { getSignatureContextHandler } from 'src/logic-functions/handlers/get-signature-context.handler';
import { type HandlerContext } from 'src/types/handler-context';
import { type MemberHandlerContext } from 'src/types/member-handler-context';
import { type SignatureContext } from 'src/types/signature-context';
import { type SignatureRequestProposal } from 'src/types/signature-request-proposal';
import { type SignatureSource } from 'src/types/signature-source';
import { type SignerInput } from 'src/types/signer-input';
import { assertTemplateSupported } from 'src/utils/assert-template-supported.util';
import { invalidInput } from 'src/utils/invalid-input.util';
import { type parseProposalInput } from 'src/utils/parse-proposal-input.util';

type ProposalInput = ReturnType<typeof parseProposalInput>;

// Checked against the same context the card loads, so the model learns right away when it picked an unknown id.
const toSource = (input: ProposalInput, context: SignatureContext): SignatureSource | null => {
  const sourceType = input.sourceType ?? (input.attachmentId ? 'PDF' : input.templateId ? 'TEMPLATE' : null);

  if (sourceType === 'PDF' && input.attachmentId !== null) {
    if (!context.attachments.some((attachment) => attachment.id === input.attachmentId)) {
      throw invalidInput('attachmentId', 'not_found');
    }
    return { type: 'PDF', attachmentId: input.attachmentId };
  }

  if (sourceType === 'TEMPLATE' && input.templateId !== null) {
    const template = context.templates.find((candidate) => candidate.id === input.templateId);
    if (!template) throw invalidInput('templateId', 'not_found');
    assertTemplateSupported(template, 'templateId');
    return { type: 'TEMPLATE', templateId: template.id, editorFields: [] };
  }

  return null;
};

// Contacts come only from CRM people; Email verification by default because it costs no credits.
const toSigners = async (ctx: HandlerContext, personIds: string[]): Promise<SignerInput[]> => {
  const contacts = await findContacts(ctx.userCore, personIds);
  const missing = personIds.findIndex((id) => !contacts.some((contact) => contact.personId === id));
  if (missing !== -1) throw invalidInput('signerPersonIds', 'not_found', missing);

  return contacts.map((contact) => ({
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    verificationMethod: 'Email',
    notificationMethod: 'Email',
    governmentId: null,
    roleId: null,
  }));
};

// Side-effect free: the tool-call card shows the proposal and only the user's click sends it.
export const proposeSignatureRequestHandler = async (
  input: ProposalInput,
  ctx: MemberHandlerContext,
): Promise<{ proposal: SignatureRequestProposal }> => {
  const context = await getSignatureContextHandler({ recordId: input.recordId }, ctx);

  return {
    proposal: {
      recordId: context.record.id,
      source: toSource(input, context),
      name: input.name,
      message: input.message,
      signers: await toSigners(ctx, input.signerPersonIds),
    },
  };
};
