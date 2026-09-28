import { defineTimelineActivityType } from 'twenty-sdk/define';

import {
  OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_SIGNATURE_REQUEST_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { buildSignatureRequestActivityType } from 'src/timeline-activity-types/build-signature-request-activity-type';

export default defineTimelineActivityType(
  buildSignatureRequestActivityType({
    universalIdentifier: OPPORTUNITY_SIGNATURE_REQUEST_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
    name: 'opportunity-signature-request',
    relationFieldUniversalIdentifier: OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
  }),
);
