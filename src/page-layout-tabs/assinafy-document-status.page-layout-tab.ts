import {
  definePageLayoutTab,
  getSystemRecordPageLayoutUniversalIdentifier,
  PageLayoutTabLayoutMode,
} from 'twenty-sdk/define';

import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  DOCUMENT_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  DOCUMENT_PANEL_WIDGET_UNIVERSAL_IDENTIFIER,
  DOCUMENT_STATUS_TAB_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

// First tab of the document's record page (the generated Home tab sits at position 10), so the status and its actions
// open first. A widget on Home would share index 0 with the generated Fields widget, and their order is not defined.
export default definePageLayoutTab({
  universalIdentifier: DOCUMENT_STATUS_TAB_UNIVERSAL_IDENTIFIER,
  pageLayoutUniversalIdentifier: getSystemRecordPageLayoutUniversalIdentifier({
    objectMetadataApplicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
    objectUniversalIdentifier: ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  }),
  title: 'Assinatura',
  position: 0,
  icon: 'IconSignature',
  layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
  widgets: [
    {
      universalIdentifier: DOCUMENT_PANEL_WIDGET_UNIVERSAL_IDENTIFIER,
      title: 'Status da assinatura',
      type: 'FRONT_COMPONENT',
      heightBehavior: 'FIT_CONTENT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier: DOCUMENT_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      },
    },
  ],
});
