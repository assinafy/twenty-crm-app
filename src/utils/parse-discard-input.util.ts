import { type DiscardInput } from 'src/types/discard-input';
import { expectObject } from 'src/utils/expect-object.util';
import { isAssinafyId } from 'src/utils/is-assinafy-id.util';
import { readString } from 'src/utils/read-string.util';

export const parseDiscardInput = (body: unknown): DiscardInput => {
  const input = expectObject(body, 'body', ['assinafyDocumentId', 'accountId']);

  return {
    assinafyDocumentId: readString(input.assinafyDocumentId, 'assinafyDocumentId', {
      test: isAssinafyId,
      required: true,
    }),
    accountId: readString(input.accountId, 'accountId', { test: isAssinafyId, required: true }),
  };
};
