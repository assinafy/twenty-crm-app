import { type definePageLayoutTab, PageLayoutTabLayoutMode } from 'twenty-sdk/define';

import { RECORD_SIGNATURES_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// "Signatures" tab added to a standard record page, rendering the record's Assinafy documents.
export const buildSignaturesTab = ({
  universalIdentifier,
  widgetUniversalIdentifier,
  pageLayoutUniversalIdentifier,
}: {
  universalIdentifier: string;
  widgetUniversalIdentifier: string;
  pageLayoutUniversalIdentifier: string;
}): Parameters<typeof definePageLayoutTab>[0] => ({
  universalIdentifier,
  pageLayoutUniversalIdentifier,
  title: 'Assinaturas',
  position: 1000,
  icon: 'IconSignature',
  layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
  widgets: [
    {
      universalIdentifier: widgetUniversalIdentifier,
      title: 'Documentos Assinafy',
      type: 'FRONT_COMPONENT',
      heightBehavior: 'TAB_VIEWPORT',
      configuration: {
        configurationType: 'FRONT_COMPONENT',
        frontComponentUniversalIdentifier: RECORD_SIGNATURES_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      },
    },
  ],
});
