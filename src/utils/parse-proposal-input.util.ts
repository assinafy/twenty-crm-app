import { MAX_ASSINAFY_ID_LENGTH, MAX_MESSAGE_LENGTH, MAX_NAME_LENGTH, MAX_SIGNERS } from 'src/constants/limits';
import { expectObject } from 'src/utils/expect-object.util';
import { isUuid } from 'src/utils/is-uuid.util';
import { readArray } from 'src/utils/read-array.util';
import { readEnum } from 'src/utils/read-enum.util';
import { readString } from 'src/utils/read-string.util';
import { readUuid } from 'src/utils/read-uuid.util';

const PROPOSAL_KEYS = ['recordId', 'sourceType', 'attachmentId', 'templateId', 'signerPersonIds', 'name', 'message'];

// Input of the propose-signature-request AI tool. Everything but the record is a suggestion the user reviews.
export const parseProposalInput = (
  body: unknown,
): {
  recordId: string;
  sourceType: 'PDF' | 'TEMPLATE' | null;
  attachmentId: string | null;
  templateId: string | null;
  signerPersonIds: string[];
  name: string | null;
  message: string | null;
} => {
  const input = expectObject(body, 'body', PROPOSAL_KEYS);

  return {
    recordId: readUuid(input.recordId, 'recordId'),
    sourceType: readEnum(input.sourceType, 'sourceType', ['PDF', 'TEMPLATE'] as const),
    attachmentId: readString(input.attachmentId, 'attachmentId', { test: isUuid })?.toLowerCase() ?? null,
    templateId: readString(input.templateId, 'templateId', { max: MAX_ASSINAFY_ID_LENGTH }),
    signerPersonIds: readArray(input.signerPersonIds, 'signerPersonIds', { min: 0, max: MAX_SIGNERS }).map(
      (item, index) => readUuid(item, 'signerPersonIds', index),
    ),
    name: readString(input.name, 'name', { max: MAX_NAME_LENGTH }),
    message: readString(input.message, 'message', { max: MAX_MESSAGE_LENGTH }),
  };
};
