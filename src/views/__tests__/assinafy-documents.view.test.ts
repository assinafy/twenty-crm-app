import { getFieldUniversalIdentifier, ViewSortDirection } from 'twenty-sdk/define';
import { expect, it } from 'vitest';

import {
  APPLICATION_UNIVERSAL_IDENTIFIER,
  ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  DOCUMENTS_VIEW_DEFAULT_SORT_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';
import documentsView from 'src/views/assinafy-documents.view';

it('lists the newest records first by creation, so unsent ones do not sink to the end', () => {
  expect(documentsView.config.sorts).toEqual([
    {
      universalIdentifier: DOCUMENTS_VIEW_DEFAULT_SORT_UNIVERSAL_IDENTIFIER,
      fieldMetadataUniversalIdentifier: getFieldUniversalIdentifier({
        applicationUniversalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
        objectUniversalIdentifier: ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
        name: 'createdAt',
      }),
      direction: ViewSortDirection.DESC,
    },
  ]);
});
