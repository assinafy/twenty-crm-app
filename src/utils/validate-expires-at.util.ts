import { invalidInput } from 'src/utils/invalid-input.util';
import { readString } from 'src/utils/read-string.util';

// Date and time with an explicit offset, so the deadline never depends on the server time zone.
const ISO_DATE_TIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/i;

// minimumMinutes null checks only the format (the send route checks the lead time after its requestId lookup).
export const validateExpiresAt = (raw: unknown, now: Date, minimumMinutes: number | null): string | null => {
  const text = readString(raw, 'expiresAt', { test: (value) => ISO_DATE_TIME_PATTERN.test(value) });

  if (text === null) {
    return null;
  }

  const expiresAt = new Date(text);
  const day = text.slice(0, 10);

  // The NaN check runs first; V8 rolls an impossible day over (02-30 becomes 03-02), so the date must round-trip.
  if (Number.isNaN(expiresAt.getTime()) || new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) {
    throw invalidInput('expiresAt', 'format');
  }

  if (minimumMinutes !== null && expiresAt.getTime() < now.getTime() + minimumMinutes * 60_000) {
    throw invalidInput('expiresAt', 'too_soon');
  }

  return expiresAt.toISOString();
};
