import { MAX_ASSINAFY_ID_LENGTH, MAX_NAME_LENGTH, MAX_SIGNERS } from 'src/constants/limits';
import { NOTIFICATION_METHODS, VERIFICATION_METHODS } from 'src/constants/signer-methods';
import { type SignerInput } from 'src/types/signer-input';
import { expectObject } from 'src/utils/expect-object.util';
import { invalidInput } from 'src/utils/invalid-input.util';
import { isValidEmail } from 'src/utils/is-valid-email.util';
import { normalizeGovernmentId } from 'src/utils/normalize-government-id.util';
import { normalizePhone } from 'src/utils/normalize-phone.util';
import { readArray } from 'src/utils/read-array.util';
import { readEnum } from 'src/utils/read-enum.util';
import { readString } from 'src/utils/read-string.util';

const SIGNER_KEYS = [
  'name',
  'email',
  'phone',
  'verificationMethod',
  'notificationMethod',
  'governmentId',
  'roleId',
];

const readNormalized = (
  value: unknown,
  field: string,
  normalize: (raw: string) => string | null,
  required: boolean,
  index: number,
): string | null => {
  const text = readString(value, field, { required, index });
  const normalized = text === null ? null : normalize(text);

  if (text !== null && normalized === null) {
    throw invalidInput(field, 'format', index);
  }

  return normalized;
};

const readSigner = (raw: unknown, index: number, source: 'PDF' | 'TEMPLATE'): SignerInput => {
  const signer = expectObject(raw, 'signers', SIGNER_KEYS, index);
  const name = readString(signer.name, 'signers.name', { max: MAX_NAME_LENGTH, required: true, index });
  const verificationMethod = readEnum(signer.verificationMethod, 'signers.verificationMethod', VERIFICATION_METHODS, {
    required: true,
    index,
  });
  const requestedChannel = readEnum(signer.notificationMethod, 'signers.notificationMethod', NOTIFICATION_METHODS, {
    index,
  });
  // Assinafy pairs Email and Whatsapp verification with the same channel; a certificate signer may use either.
  const notificationMethod =
    verificationMethod === 'DigitalCertificate' ? (requestedChannel ?? 'Email') : verificationMethod;

  if (requestedChannel !== null && requestedChannel !== notificationMethod) {
    throw invalidInput('signers.notificationMethod', 'mismatch', index);
  }

  const email = readString(signer.email, 'signers.email', {
    test: isValidEmail,
    required: notificationMethod === 'Email',
    index,
  });
  const phone = readNormalized(signer.phone, 'signers.phone', normalizePhone, notificationMethod === 'Whatsapp', index);
  // Only a certificate signature checks the id; for other methods it is dropped.
  const governmentId =
    verificationMethod === 'DigitalCertificate'
      ? readNormalized(signer.governmentId, 'signers.governmentId', normalizeGovernmentId, true, index)
      : null;

  const roleId = readString(signer.roleId, 'signers.roleId', {
    max: MAX_ASSINAFY_ID_LENGTH,
    required: source === 'TEMPLATE',
    index,
  });

  if (source === 'PDF' && roleId !== null) {
    throw invalidInput('signers.roleId', 'not_allowed', index);
  }

  return { name, email, phone, verificationMethod, notificationMethod, governmentId, roleId };
};

// The same email would resolve to one Assinafy signer, and one phone would get every WhatsApp message.
// Phones only collide for WhatsApp-notified signers: other signers' phones are never sent to Assinafy.
const assertDistinct = (signers: SignerInput[]): void => {
  const seen = new Set<string>();
  const claim = (key: string, field: string, index: number): void => {
    if (seen.has(key)) {
      throw invalidInput(field, 'duplicate', index);
    }

    seen.add(key);
  };

  signers.forEach((signer, index) => {
    if (signer.email !== null) {
      claim(`email:${signer.email.toLowerCase()}`, 'signers.email', index);
    }

    if (signer.phone !== null && signer.notificationMethod === 'Whatsapp') {
      claim(`phone:${signer.phone}`, 'signers.phone', index);
    }

    if (signer.roleId !== null) {
      claim(`role:${signer.roleId}`, 'signers.roleId', index);
    }
  });
};

export const validateSigners = (raw: unknown, { source }: { source: 'PDF' | 'TEMPLATE' }): SignerInput[] => {
  const signers = readArray(raw, 'signers', { min: 1, max: MAX_SIGNERS }).map((item, index) =>
    readSigner(item, index, source),
  );

  assertDistinct(signers);

  return signers;
};
