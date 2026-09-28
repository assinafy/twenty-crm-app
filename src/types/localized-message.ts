import { type MessageDescriptor, type TranslationValues } from 'twenty-sdk/front-component';

// A translatable message with its placeholder values; front components render it with t(message, values).
export type LocalizedMessage = {
  message: MessageDescriptor;
  values?: TranslationValues;
};
