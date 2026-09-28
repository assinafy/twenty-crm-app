import { defineField, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  OPPORTUNITY_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { buildAssinafyDocumentsRelationField } from 'src/fields/build-assinafy-documents-relation-field';

export default defineField(
  buildAssinafyDocumentsRelationField({
    universalIdentifier: OPPORTUNITY_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
    relationTargetFieldMetadataUniversalIdentifier: OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
  }),
);
