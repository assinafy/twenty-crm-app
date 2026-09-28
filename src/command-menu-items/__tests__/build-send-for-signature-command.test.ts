import { describe, expect, it } from 'vitest';

import { buildSendForSignatureCommand } from 'src/command-menu-items/build-send-for-signature-command';
import { SEND_FOR_SIGNATURE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

describe('buildSendForSignatureCommand', () => {
  // The availability expression is rewritten to a string at build time, so it is not asserted here.
  it('builds the pinned single-record command that opens the send flow', () => {
    expect(
      buildSendForSignatureCommand({ universalIdentifier: 'command-id', objectUniversalIdentifier: 'person-object-id' }),
    ).toMatchObject({
      universalIdentifier: 'command-id',
      label: 'Enviar para assinatura',
      shortLabel: 'Enviar para assinatura',
      isPinned: true,
      availabilityType: 'RECORD_SELECTION',
      availabilityObjectUniversalIdentifier: 'person-object-id',
      frontComponentUniversalIdentifier: SEND_FOR_SIGNATURE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
    });
  });
});
