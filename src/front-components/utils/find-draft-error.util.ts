import {
  MAX_EDITOR_FIELD_VALUE_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  SEND_MIN_EXPIRATION_MINUTES,
} from 'src/constants/limits';
import { buildSignatureRequestInput } from 'src/front-components/utils/build-signature-request-input.util';
import { type AppError } from 'src/types/app-error';
import { type SendFlowState } from 'src/types/send-flow-state';
import { type SignatureRequestInput } from 'src/types/signature-request-input';
import { type TemplateSummary } from 'src/types/template-summary';
import { AppFailure } from 'src/utils/app-failure.util';
import { assertTemplateSupported } from 'src/utils/assert-template-supported.util';
import { invalidInput } from 'src/utils/invalid-input.util';
import { readString } from 'src/utils/read-string.util';
import { readUuid } from 'src/utils/read-uuid.util';
import { validateExpiresAt } from 'src/utils/validate-expires-at.util';
import { validateSigners } from 'src/utils/validate-signers.util';

const checkDocument = (input: SignatureRequestInput, templates: TemplateSummary[], now: Date): void => {
  if (input.source.type === 'PDF') {
    readUuid(input.source.attachmentId, 'source.attachmentId');
  } else {
    const { templateId, editorFields } = input.source;
    const template = templates.find((candidate) => candidate.id === templateId);

    if (template === undefined) {
      throw invalidInput('source.templateId', 'required');
    }

    assertTemplateSupported(template, 'source.templateId');

    editorFields.forEach(({ value }, index) =>
      readString(value, 'source.editorFields.value', { max: MAX_EDITOR_FIELD_VALUE_LENGTH, required: true, index }),
    );
  }

  readString(input.name, 'name', { max: MAX_NAME_LENGTH, required: true });
  readString(input.message, 'message', { max: MAX_MESSAGE_LENGTH });
  // The send's own margin, so a deadline accepted here is still accepted after the review.
  validateExpiresAt(input.expiresAt, now, SEND_MIN_EXPIRATION_MINUTES);
};

// First problem of a step, checked with the server's own validators so both sides agree; null when the step is valid.
export const findDraftError = (
  state: Pick<SendFlowState, 'draft' | 'context'>,
  step: 'DOCUMENT' | 'SIGNERS',
  now: Date,
): AppError | null => {
  try {
    const input = buildSignatureRequestInput(state.draft, state.context.record.id, null);

    if (step === 'DOCUMENT') {
      checkDocument(input, state.context.templates, now);
    } else {
      validateSigners(input.signers, { source: input.source.type });
    }

    return null;
  } catch (error) {
    if (error instanceof AppFailure) {
      return { code: error.code, message: error.message, details: error.details };
    }

    throw error;
  }
};
