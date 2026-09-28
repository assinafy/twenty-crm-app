import { PROVIDER_MESSAGE_MAX_LENGTH } from 'src/constants/limits';

const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;
// Bare domain with a path carries a token (e.g. a signing link); a bare domain without one is harmless prose. The last
// label must start with a letter, so a CNPJ such as 12.345.678/0001-90 is left to the number rule.
const DOMAIN_PATH_PATTERN = /\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z][a-z0-9-]*\/\S*/gi;
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
// Phones, CPF/CNPJ and similar ids, with the separators people type inside them.
const NUMBER_PATTERN = /[+(]?\d(?:[\d.\-/ ()]*\d)?/g;
// Landlines with DDD have 10 digits; anything shorter (dates, CEPs, counts) stays readable.
const MIN_REDACTED_DIGITS = 10;

// Provider messages can echo signer contacts, signing links or government ids; keep only the explanation.
// Addresses go first: a link rule may start right after the '@' and take only the domain, leaving the local part out.
// A link carrying an '@' is then hidden whole as an address.
export const sanitizeProviderMessage = (message: string): string => {
  const sanitized = message
    .replace(/\s+/g, ' ')
    .replace(EMAIL_PATTERN, '[e-mail]')
    .replace(URL_PATTERN, '[link]')
    .replace(DOMAIN_PATH_PATTERN, '[link]')
    .replace(NUMBER_PATTERN, (match) =>
      match.replace(/\D/g, '').length >= MIN_REDACTED_DIGITS ? '[número]' : match,
    )
    .trim();

  // Cut by code units, but never leave half of a surrogate pair before the ellipsis.
  return sanitized.length > PROVIDER_MESSAGE_MAX_LENGTH
    ? `${sanitized.slice(0, PROVIDER_MESSAGE_MAX_LENGTH - 1).replace(/[\uD800-\uDBFF]$/, '')}…`
    : sanitized;
};
