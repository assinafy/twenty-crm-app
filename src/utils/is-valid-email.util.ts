// Same pattern the Assinafy SDK enforces, so anything accepted here is accepted by signers.create.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

export const isValidEmail = (value: string): boolean =>
  value.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(value);
