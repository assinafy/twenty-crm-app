import { expectObject } from 'src/utils/expect-object.util';
import { readUuid } from 'src/utils/read-uuid.util';

export const parseRecordIdInput = (body: unknown): { recordId: string } => {
  const input = expectObject(body, 'body', ['recordId']);

  return { recordId: readUuid(input.recordId, 'recordId') };
};
