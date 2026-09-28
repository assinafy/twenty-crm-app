import { describe, expect, it } from 'vitest';

import { ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { buildSignatureRequestActivityType } from 'src/timeline-activity-types/build-signature-request-activity-type';

describe('buildSignatureRequestActivityType', () => {
  it('emits the entry when an assinafyDocument is linked through the relation field', () => {
    expect(
      buildSignatureRequestActivityType({
        universalIdentifier: 'activity-type-id',
        name: 'person-signature-request',
        relationFieldUniversalIdentifier: 'person-field-id',
      }),
    ).toEqual({
      universalIdentifier: 'activity-type-id',
      name: 'person-signature-request',
      label: 'criou uma solicitação de assinatura',
      icon: 'IconSignature',
      emit: {
        on: 'linked',
        objectUniversalIdentifier: ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
        through: { relationFieldUniversalIdentifier: 'person-field-id' },
      },
    });
  });
});
