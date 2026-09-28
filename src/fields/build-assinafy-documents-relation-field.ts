import { type defineField, FieldType, RelationType } from 'twenty-sdk/define';

import { ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Reverse (ONE_TO_MANY) side of an assinafyDocument relation, added to a standard object.
export const buildAssinafyDocumentsRelationField = ({
  universalIdentifier,
  objectUniversalIdentifier,
  relationTargetFieldMetadataUniversalIdentifier,
}: {
  universalIdentifier: string;
  objectUniversalIdentifier: string;
  relationTargetFieldMetadataUniversalIdentifier: string;
}): Parameters<typeof defineField>[0] => ({
  universalIdentifier,
  objectUniversalIdentifier,
  type: FieldType.RELATION,
  name: 'assinafyDocuments',
  label: 'Documentos Assinafy',
  description: 'Documentos enviados para assinatura com a Assinafy.',
  icon: 'IconSignature',
  relationTargetObjectMetadataUniversalIdentifier: ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  relationTargetFieldMetadataUniversalIdentifier,
  universalSettings: { relationType: RelationType.ONE_TO_MANY },
});
