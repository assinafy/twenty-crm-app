import { type defineCommandMenuItem, numberOfSelectedRecords } from 'twenty-sdk/define';

import { SEND_FOR_SIGNATURE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Pinned "Enviar para assinatura" command on a standard object's record selection (one record).
export const buildSendForSignatureCommand = ({
  universalIdentifier,
  objectUniversalIdentifier,
}: {
  universalIdentifier: string;
  objectUniversalIdentifier: string;
}): Parameters<typeof defineCommandMenuItem>[0] => ({
  universalIdentifier,
  label: 'Enviar para assinatura',
  shortLabel: 'Enviar para assinatura',
  isPinned: true,
  availabilityType: 'RECORD_SELECTION',
  availabilityObjectUniversalIdentifier: objectUniversalIdentifier,
  conditionalAvailabilityExpression: numberOfSelectedRecords === 1,
  frontComponentUniversalIdentifier: SEND_FOR_SIGNATURE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
});
