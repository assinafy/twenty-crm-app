import { defineTimelineActivityType } from 'twenty-sdk/define';

import {
  PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_SIGNATURE_REQUEST_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { buildSignatureRequestActivityType } from 'src/timeline-activity-types/build-signature-request-activity-type';

export default defineTimelineActivityType(
  buildSignatureRequestActivityType({
    universalIdentifier: PERSON_SIGNATURE_REQUEST_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
    name: 'person-signature-request',
    relationFieldUniversalIdentifier: PERSON_FIELD_UNIVERSAL_IDENTIFIER,
  }),
);
