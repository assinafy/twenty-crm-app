import { defineCommandMenuItem, STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import { buildSendForSignatureCommand } from 'src/command-menu-items/build-send-for-signature-command';
import { SEND_FOR_SIGNATURE_OPPORTUNITY_COMMAND_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

export default defineCommandMenuItem(
  buildSendForSignatureCommand({
    universalIdentifier: SEND_FOR_SIGNATURE_OPPORTUNITY_COMMAND_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier: STANDARD_OBJECT_UNIVERSAL_IDENTIFIERS.opportunity.universalIdentifier,
  }),
);
