import { readString } from 'src/utils/read-string.util';

export const readContractDate = (value: unknown, field: string): string | null =>
  readString(value, field, {
    test: (date) => /^[1-9]\d{3}-\d{2}-\d{2}$/.test(date) &&
      Number.isFinite(Date.parse(`${date}T00:00:00Z`)) &&
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date,
  });
