import { normalizePhone } from 'src/utils/normalize-phone.util';

// Twenty stores the calling code ("+55") and the national number separately.
export const buildE164Phone = (
  callingCode: string | null | undefined,
  number: string | null | undefined,
): string | null => {
  const codeDigits = callingCode?.replace(/\D/g, '') ?? '';
  const numberDigits = number?.replace(/\D/g, '') ?? '';

  return codeDigits && numberDigits ? normalizePhone(`+${codeDigits}${numberDigits}`) : null;
};
