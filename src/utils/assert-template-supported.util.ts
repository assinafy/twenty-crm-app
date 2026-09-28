import { type TemplateSummary } from 'src/types/template-summary';
import { invalidInput } from 'src/utils/invalid-input.util';

// Shared by the draft check and the send check so both report the same reason for an unusable template.
export const assertTemplateSupported = (template: Pick<TemplateSummary, 'unsupportedReason'>, field: string): void => {
  if (template.unsupportedReason !== null) {
    throw invalidInput(field, template.unsupportedReason === 'TOO_LARGE' ? 'too_large' : 'unsupported');
  }
};
