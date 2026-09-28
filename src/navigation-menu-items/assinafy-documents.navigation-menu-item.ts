import { defineNavigationMenuItem, NavigationMenuItemType } from 'twenty-sdk/define';

import {
  DOCUMENTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  DOCUMENTS_VIEW_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

export default defineNavigationMenuItem({
  universalIdentifier: DOCUMENTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER,
  name: 'Documentos Assinafy',
  icon: 'IconSignature',
  color: 'blue',
  position: 0,
  type: NavigationMenuItemType.VIEW,
  viewUniversalIdentifier: DOCUMENTS_VIEW_UNIVERSAL_IDENTIFIER,
});
