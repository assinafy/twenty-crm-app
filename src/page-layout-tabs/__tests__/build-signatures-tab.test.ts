import { PageLayoutTabLayoutMode } from 'twenty-sdk/define';
import { describe, expect, it } from 'vitest';

import { RECORD_SIGNATURES_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';
import { buildSignaturesTab } from 'src/page-layout-tabs/build-signatures-tab';

describe('buildSignaturesTab', () => {
  it('adds a full-height Assinaturas tab rendering the record signatures component', () => {
    const tab = buildSignaturesTab({
      universalIdentifier: 'tab-id',
      widgetUniversalIdentifier: 'widget-id',
      pageLayoutUniversalIdentifier: 'layout-id',
    });

    expect(tab).toMatchObject({
      universalIdentifier: 'tab-id',
      pageLayoutUniversalIdentifier: 'layout-id',
      title: 'Assinaturas',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
    });
    expect(tab.widgets).toEqual([
      {
        universalIdentifier: 'widget-id',
        title: 'Documentos Assinafy',
        type: 'FRONT_COMPONENT',
        heightBehavior: 'TAB_VIEWPORT',
        configuration: {
          configurationType: 'FRONT_COMPONENT',
          frontComponentUniversalIdentifier: RECORD_SIGNATURES_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
        },
      },
    ]);
  });
});
