import { invalidInput } from 'src/utils/invalid-input.util';

// Absent reads as [] when `min` is 0.
export const readArray = (
  value: unknown,
  field: string,
  { min, max }: { min: number; max: number },
): unknown[] => {
  if (value === undefined || value === null) {
    if (min > 0) {
      throw invalidInput(field, 'required');
    }

    return [];
  }

  if (!Array.isArray(value)) {
    throw invalidInput(field, 'type');
  }

  if (value.length < min) {
    throw invalidInput(field, 'too_few');
  }

  if (value.length > max) {
    throw invalidInput(field, 'too_many');
  }

  return value;
};
