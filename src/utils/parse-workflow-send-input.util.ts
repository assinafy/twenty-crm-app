import { MAX_ASSINAFY_ID_LENGTH, MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH, MAX_SIGNERS } from 'src/constants/limits';
import { type WorkflowSendInput } from 'src/types/workflow-send-input';
import { expectObject } from 'src/utils/expect-object.util';
import { invalidInput } from 'src/utils/invalid-input.util';
import { isUuid } from 'src/utils/is-uuid.util';
import { readArray } from 'src/utils/read-array.util';
import { readEnum } from 'src/utils/read-enum.util';
import { readNumber } from 'src/utils/read-number.util';
import { readString } from 'src/utils/read-string.util';
import { readUuid } from 'src/utils/read-uuid.util';

const WORKFLOW_KEYS = [
  'attachment',
  'templateId',
  'signers',
  'person',
  'company',
  'opportunity',
  'name',
  'message',
  'verificationMethod',
  'expiresInDays',
  'maxCredits',
];
// The workflow form shows these options as they are spelled; each maps to the Assinafy API value.
const VERIFICATION_METHODS = { 'E-mail': 'Email', WhatsApp: 'Whatsapp' } as const;
const MAX_EXPIRES_IN_DAYS = 365;

// Record inputs arrive either as an id or as the record object. Anything else (a list, an object without an id) is
// passed on unchanged, so it fails as the wrong type instead of reading as a blank field.
const toRecordId = (value: unknown): unknown =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && 'id' in value ? value.id : value;

// Lowercased like readUuid.
const readOptionalRecordId = (value: unknown, field: string): string | null =>
  readString(toRecordId(value), field, { test: isUuid })?.toLowerCase() ?? null;

// A workflow variable embedded in text resolves to a string; a blank field is absent.
const toNumber = (value: unknown): unknown =>
  typeof value === 'string' ? (value.trim() === '' ? null : Number(value)) : value;

export const parseWorkflowSendInput = (body: unknown): WorkflowSendInput => {
  const input = expectObject(body, 'body', WORKFLOW_KEYS);
  const attachmentId = readOptionalRecordId(input.attachment, 'attachment');
  const templateId = readString(input.templateId, 'templateId', { max: MAX_ASSINAFY_ID_LENGTH });

  if ((attachmentId === null) === (templateId === null)) {
    throw invalidInput('source', attachmentId === null ? 'required' : 'conflict');
  }

  const signerPersonIds = readArray(input.signers, 'signers', { min: 1, max: MAX_SIGNERS }).map((item, index) =>
    readUuid(toRecordId(item), 'signers', index),
  );
  const personId = readOptionalRecordId(input.person, 'person');
  const companyId = readOptionalRecordId(input.company, 'company');
  const opportunityId = readOptionalRecordId(input.opportunity, 'opportunity');

  if (personId === null && companyId === null && opportunityId === null) {
    throw invalidInput('record', 'required');
  }

  return {
    attachmentId,
    templateId,
    signerPersonIds,
    personId,
    companyId,
    opportunityId,
    name: readString(input.name, 'name', { max: MAX_NAME_LENGTH }),
    message: readString(input.message, 'message', { max: MAX_MESSAGE_LENGTH }),
    verificationMethod:
      VERIFICATION_METHODS[
        readEnum(input.verificationMethod, 'verificationMethod', ['E-mail', 'WhatsApp'] as const) ?? 'E-mail'
      ],
    expiresInDays: readNumber(toNumber(input.expiresInDays), 'expiresInDays', {
      min: 1,
      max: MAX_EXPIRES_IN_DAYS,
      integer: true,
    }),
    // 0 allows only sends covered by the plan's documents.
    maxCredits: readNumber(toNumber(input.maxCredits), 'maxCredits', { min: 0 }) ?? 0,
  };
};
