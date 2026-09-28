import { type AppResult } from 'src/types/app-result';
import { type SignatureRequestProposal } from 'src/types/signature-request-proposal';
import { type SignatureSource } from 'src/types/signature-source';

type Parsed = AppResult<{ proposal: SignatureRequestProposal }>;

const INVALID_OUTPUT: Parsed = { ok: false, error: { code: 'INTERNAL', message: 'Unexpected tool output' } };

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

// The chat compacts tool output (null, '' and [] are dropped), so the source is rebuilt with its empty values.
const toSource = (source: unknown): SignatureSource | null => {
  if (!isObject(source)) return null;
  if (source.type === 'TEMPLATE' && typeof source.templateId === 'string') {
    return {
      type: 'TEMPLATE',
      templateId: source.templateId,
      editorFields: Array.isArray(source.editorFields) ? source.editorFields : [],
    };
  }
  return source.type === 'PDF' && typeof source.attachmentId === 'string'
    ? { type: 'PDF', attachmentId: source.attachmentId }
    : null;
};

// Reads the propose-signature-request tool output as the chat delivers it: Twenty wraps a logic-function result as
// { success, message, result } and strips empty values (the bare result is accepted too). Its contents are only a
// prefill: every value is validated again by the send flow and the server before anything is sent.
export const parseToolCallProposal = (output: Record<string, unknown> | undefined): Parsed => {
  const data = output?.success === true ? output.result : output?.success === false ? undefined : output;

  if (!isObject(data)) return INVALID_OUTPUT;

  if (data.ok === false) {
    const { error } = data;

    return isObject(error) && typeof error.code === 'string'
      ? ({
          ok: false,
          error: { ...error, code: error.code, message: typeof error.message === 'string' ? error.message : '' },
        } as Parsed)
      : INVALID_OUTPUT;
  }

  const { proposal } = data;

  if (data.ok !== true || !isObject(proposal) || typeof proposal.recordId !== 'string') return INVALID_OUTPUT;
  if (proposal.signers !== undefined && !Array.isArray(proposal.signers)) return INVALID_OUTPUT;

  return {
    ok: true,
    proposal: {
      recordId: proposal.recordId,
      source: toSource(proposal.source),
      name: typeof proposal.name === 'string' ? proposal.name : null,
      message: typeof proposal.message === 'string' ? proposal.message : null,
      signers: (proposal.signers ?? []) as SignatureRequestProposal['signers'],
    },
  };
};
