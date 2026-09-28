import { defineField, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  PERSON_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { buildAssinafyDocumentsRelationField } from 'src/fields/build-assinafy-documents-relation-field';

export default defineField(
  buildAssinafyDocumentsRelationField({
    universalIdentifier: PERSON_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.person.universalIdentifier,
    relationTargetFieldMetadataUniversalIdentifier: PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  }),
);
