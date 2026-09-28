import { FieldType, RelationType } from 'twenty-sdk/define';
import { describe, expect, it } from 'vitest';

import { ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { buildAssinafyDocumentsRelationField } from 'src/fields/build-assinafy-documents-relation-field';

describe('buildAssinafyDocumentsRelationField', () => {
  it('builds the one-to-many side pointing back at the assinafyDocument relation', () => {
    expect(
      buildAssinafyDocumentsRelationField({
        universalIdentifier: 'field-id',
        objectUniversalIdentifier: 'person-object-id',
        relationTargetFieldMetadataUniversalIdentifier: 'person-field-id',
      }),
    ).toEqual({
      universalIdentifier: 'field-id',
      objectUniversalIdentifier: 'person-object-id',
      type: FieldType.RELATION,
      name: 'assinafyDocuments',
      label: 'Documentos Assinafy',
      description: 'Documentos enviados para assinatura com a Assinafy.',
      icon: 'IconSignature',
      relationTargetObjectMetadataUniversalIdentifier: ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
      relationTargetFieldMetadataUniversalIdentifier: 'person-field-id',
      universalSettings: { relationType: RelationType.ONE_TO_MANY },
    });
  });
});
