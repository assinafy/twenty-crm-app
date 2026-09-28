import { definePageLayoutTab, STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS } from 'twenty-sdk/define';

import {
  PERSON_SIGNATURES_TAB_UNIVERSAL_IDENTIFIER,
  PERSON_SIGNATURES_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import { buildSignaturesTab } from 'src/page-layout-tabs/build-signatures-tab';

export default definePageLayoutTab(
  buildSignaturesTab({
    universalIdentifier: PERSON_SIGNATURES_TAB_UNIVERSAL_IDENTIFIER,
    widgetUniversalIdentifier: PERSON_SIGNATURES_WIDGET_UNIVERSAL_IDENTIFIER,
    pageLayoutUniversalIdentifier:
      STANDARD_PAGE_LAYOUT_UNIVERSAL_IDENTIFIERS.personRecordPage.universalIdentifier,
  }),
);
