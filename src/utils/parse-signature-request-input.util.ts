import {
  MAX_ASSINAFY_ID_LENGTH,
  MAX_EDITOR_FIELD_VALUE_LENGTH,
  MAX_EDITOR_FIELDS,
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  MIN_EXPIRATION_MINUTES,
} from 'src/constants/limits';
import { type SignatureRequestInput } from 'src/types/signature-request-input';
import { type SignatureSource } from 'src/types/signature-source';
import { expectObject } from 'src/utils/expect-object.util';
import { invalidInput } from 'src/utils/invalid-input.util';
import { isAssinafyId } from 'src/utils/is-assinafy-id.util';
import { readArray } from 'src/utils/read-array.util';
import { readEnum } from 'src/utils/read-enum.util';
import { readString } from 'src/utils/read-string.util';
import { readUuid } from 'src/utils/read-uuid.util';
import { validateExpiresAt } from 'src/utils/validate-expires-at.util';
import { validateSigners } from 'src/utils/validate-signers.util';

const BODY_KEYS = [
  'recordId',
  'source',
  'name',
  'signers',
  'message',
  'expiresAt',
  'sequential',
  'assinafyDocumentId',
];
const PDF_SOURCE_KEYS = ['type', 'attachmentId'];
const TEMPLATE_SOURCE_KEYS = ['type', 'templateId', 'editorFields'];

const readSource = (raw: unknown): SignatureSource => {
  const { type } = expectObject(raw, 'source', [...PDF_SOURCE_KEYS, ...TEMPLATE_SOURCE_KEYS]);
  const sourceType = readEnum(type, 'source.type', ['PDF', 'TEMPLATE'] as const, { required: true });

  if (sourceType === 'PDF') {
    const source = expectObject(raw, 'source', PDF_SOURCE_KEYS);

    return { type: 'PDF', attachmentId: readUuid(source.attachmentId, 'source.attachmentId') };
  }

  const source = expectObject(raw, 'source', TEMPLATE_SOURCE_KEYS);
  const editorFields = readArray(source.editorFields, 'source.editorFields', {
    min: 0,
    max: MAX_EDITOR_FIELDS,
  }).map((item, index) => {
    const editorField = expectObject(item, 'source.editorFields', ['fieldId', 'value'], index);

    return {
      fieldId: readString(editorField.fieldId, 'source.editorFields.fieldId', {
        max: MAX_ASSINAFY_ID_LENGTH,
        required: true,
        index,
      }),
      value: readString(editorField.value, 'source.editorFields.value', {
        max: MAX_EDITOR_FIELD_VALUE_LENGTH,
        required: true,
        index,
      }),
    };
  });

  return {
    type: 'TEMPLATE',
    templateId: readString(source.templateId, 'source.templateId', { max: MAX_ASSINAFY_ID_LENGTH, required: true }),
    editorFields,
  };
};

// minimumMinutes null skips the deadline lead-time check and keeps the format check.
export const parseSignatureRequestInput = (
  body: unknown,
  now: Date,
  minimumMinutes: number | null = MIN_EXPIRATION_MINUTES,
): SignatureRequestInput => {
  const input = expectObject(body, 'body', BODY_KEYS);
  const recordId = readUuid(input.recordId, 'recordId');
  const source = readSource(input.source);
  const name = readString(input.name, 'name', { max: MAX_NAME_LENGTH, required: true });
  const signers = validateSigners(input.signers, { source: source.type });
  const message = readString(input.message, 'message', { max: MAX_MESSAGE_LENGTH });
  const expiresAt = validateExpiresAt(input.expiresAt, now, minimumMinutes);

  if (input.sequential !== undefined && input.sequential !== null && typeof input.sequential !== 'boolean') {
    throw invalidInput('sequential', 'type');
  }

  const assinafyDocumentId = readString(input.assinafyDocumentId, 'assinafyDocumentId', { test: isAssinafyId });

  if (source.type === 'TEMPLATE' && assinafyDocumentId !== null) {
    throw invalidInput('assinafyDocumentId', 'not_allowed');
  }

  return {
    recordId,
    source,
    name,
    signers,
    message,
    expiresAt,
    sequential: input.sequential === true,
    assinafyDocumentId,
  };
};
