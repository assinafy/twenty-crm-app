import { invalidInput } from 'src/utils/invalid-input.util';

type ReadNumberOptions = { min: number; max?: number; integer?: boolean };

// Finite number within [min, max]; undefined and null read as null (or fail with `required`).
export function readNumber(
  value: unknown,
  field: string,
  options: ReadNumberOptions & { required: true },
): number;
export function readNumber(
  value: unknown,
  field: string,
  options: ReadNumberOptions & { required?: boolean },
): number | null;
export function readNumber(
  value: unknown,
  field: string,
  { min, max, integer = false, required = false }: ReadNumberOptions & { required?: boolean },
): number | null {
  if (value === undefined || value === null) {
    if (required) {
      throw invalidInput(field, 'required');
    }

    return null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value) || (integer && !Number.isInteger(value))) {
    throw invalidInput(field, 'type');
  }

  if (value < min || (max !== undefined && value > max)) {
    throw invalidInput(field, 'out_of_range');
  }

  return value;
}
