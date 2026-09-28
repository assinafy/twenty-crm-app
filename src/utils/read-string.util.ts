import { invalidInput } from 'src/utils/invalid-input.util';

type ReadStringOptions = {
  max?: number;
  test?: (value: string) => boolean;
  index?: number;
};

// Trimmed string; undefined, null and blank read as null (or fail with `required`).
export function readString(
  value: unknown,
  field: string,
  options: ReadStringOptions & { required: true },
): string;
export function readString(
  value: unknown,
  field: string,
  options?: ReadStringOptions & { required?: boolean },
): string | null;
export function readString(
  value: unknown,
  field: string,
  { max, test, index, required = false }: ReadStringOptions & { required?: boolean } = {},
): string | null {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw invalidInput(field, 'type', index);
  }

  const text = value?.trim() ?? '';

  if (text === '') {
    if (required) {
      throw invalidInput(field, 'required', index);
    }

    return null;
  }

  if (max !== undefined && text.length > max) {
    throw invalidInput(field, 'too_long', index);
  }

  if (test && !test(text)) {
    throw invalidInput(field, 'format', index);
  }

  return text;
}
