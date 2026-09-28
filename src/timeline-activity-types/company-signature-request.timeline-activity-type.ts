import { defineTimelineActivityType } from 'twenty-sdk/define';

import {
  COMPANY_FIELD_UNIVERSAL_IDENTIFIER,
  COMPANY_SIGNATURE_REQUEST_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { buildSignatureRequestActivityType } from 'src/timeline-activity-types/build-signature-request-activity-type';

export default defineTimelineActivityType(
  buildSignatureRequestActivityType({
    universalIdentifier: COMPANY_SIGNATURE_REQUEST_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
    name: 'company-signature-request',
    relationFieldUniversalIdentifier: COMPANY_FIELD_UNIVERSAL_IDENTIFIER,
  }),
);
