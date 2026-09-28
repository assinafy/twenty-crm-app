import { invalidInput } from 'src/utils/invalid-input.util';
import { readString } from 'src/utils/read-string.util';

type ReadEnumOptions = { index?: number };

export function readEnum<TOption extends string>(
  value: unknown,
  field: string,
  options: readonly TOption[],
  settings: ReadEnumOptions & { required: true },
): TOption;
export function readEnum<TOption extends string>(
  value: unknown,
  field: string,
  options: readonly TOption[],
  settings?: ReadEnumOptions & { required?: boolean },
): TOption | null;
export function readEnum<TOption extends string>(
  value: unknown,
  field: string,
  options: readonly TOption[],
  { index, required = false }: ReadEnumOptions & { required?: boolean } = {},
): TOption | null {
  const text = readString(value, field, { index, required });

  if (text === null) {
    return null;
  }

  const option = options.find((candidate) => candidate === text);

  if (option === undefined) {
    throw invalidInput(field, 'format', index);
  }

  return option;
}
