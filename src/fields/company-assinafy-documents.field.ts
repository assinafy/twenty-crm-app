import { defineField, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  COMPANY_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER,
  COMPANY_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { buildAssinafyDocumentsRelationField } from 'src/fields/build-assinafy-documents-relation-field';

export default defineField(
  buildAssinafyDocumentsRelationField({
    universalIdentifier: COMPANY_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.company.universalIdentifier,
    relationTargetFieldMetadataUniversalIdentifier: COMPANY_FIELD_UNIVERSAL_IDENTIFIER,
  }),
);
