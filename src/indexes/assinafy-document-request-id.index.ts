import { defineIndex } from 'twenty-sdk/define';

import {
  ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  REQUEST_ID_FIELD_UNIVERSAL_IDENTIFIER,
  REQUEST_ID_INDEX_FIELD_UNIVERSAL_IDENTIFIER,
  REQUEST_ID_INDEX_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// One record per send attempt: a repeated request with the same key can never send twice.
export default defineIndex({
  universalIdentifier: REQUEST_ID_INDEX_UNIVERSAL_IDENTIFIER,
  objectUniversalIdentifier: ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  isUnique: true,
  fields: [
    {
      universalIdentifier: REQUEST_ID_INDEX_FIELD_UNIVERSAL_IDENTIFIER,
      fieldUniversalIdentifier: REQUEST_ID_FIELD_UNIVERSAL_IDENTIFIER,
    },
  ],
});
