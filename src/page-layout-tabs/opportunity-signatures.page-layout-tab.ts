import { definePageLayoutTab, STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  OPPORTUNITY_SIGNATURES_TAB_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_SIGNATURES_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { buildSignaturesTab } from 'src/page-layout-tabs/build-signatures-tab';

export default definePageLayoutTab(
  buildSignaturesTab({
    universalIdentifier: OPPORTUNITY_SIGNATURES_TAB_UNIVERSAL_IDENTIFIER,
    widgetUniversalIdentifier: OPPORTUNITY_SIGNATURES_WIDGET_UNIVERSAL_IDENTIFIER,
    pageLayoutUniversalIdentifier:
      STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.opportunityRecordPage.universalIdentifier,
  }),
);
