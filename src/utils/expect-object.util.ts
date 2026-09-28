import { invalidInput } from 'src/utils/invalid-input.util';

const MAX_REPORTED_KEY_LENGTH = 64;

// Plain object check; with `allowedKeys`, any other key is rejected so callers never silently drop input.
export const expectObject = (
  raw: unknown,
  field: string,
  allowedKeys?: readonly string[],
  index?: number,
): Record<string, unknown> => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw invalidInput(field, 'type', index);
  }

  const object = raw as Record<string, unknown>;
  const unknownKey = allowedKeys && Object.keys(object).find((key) => !allowedKeys.includes(key));

  if (unknownKey !== undefined) {
    throw invalidInput(`${field}.${unknownKey.slice(0, MAX_REPORTED_KEY_LENGTH)}`, 'unknown_key', index);
  }

  return object;
};
