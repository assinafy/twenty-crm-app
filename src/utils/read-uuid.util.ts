import { isUuid } from 'src/utils/is-uuid.util';
import { readString } from 'src/utils/read-string.util';

// Lowercased, so ids compare equal to the ones Twenty returns whatever case the caller used.
export const readUuid = (value: unknown, field: string, index?: number): string =>
  readString(value, field, { test: isUuid, required: true, index }).toLowerCase();
