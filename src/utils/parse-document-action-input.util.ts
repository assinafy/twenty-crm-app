import { expectObject } from 'src/utils/expect-object.util';
import { readUuid } from 'src/utils/read-uuid.util';

export const parseDocumentActionInput = (body: unknown): { documentRecordId: string } => {
  const input = expectObject(body, 'body', ['documentRecordId']);

  return { documentRecordId: readUuid(input.documentRecordId, 'documentRecordId') };
};
