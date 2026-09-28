import { type defineTimelineActivityType } from 'twenty-sdk/define';

import { ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// "criou uma solicitação de assinatura" entry on the record an assinafyDocument is linked to through relationField.
export const buildSignatureRequestActivityType = ({
  universalIdentifier,
  name,
  relationFieldUniversalIdentifier,
}: {
  universalIdentifier: string;
  name: string;
  relationFieldUniversalIdentifier: string;
}): Parameters<typeof defineTimelineActivityType>[0] => ({
  universalIdentifier,
  name,
  label: 'criou uma solicitação de assinatura',
  icon: 'IconSignature',
  emit: {
    on: 'linked',
    objectUniversalIdentifier: ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
    through: { relationFieldUniversalIdentifier },
  },
});
