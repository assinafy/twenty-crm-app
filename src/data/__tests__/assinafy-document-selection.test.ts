import { expect, it } from 'vitest';

import { buildDocumentRecord } from 'src/__tests__/fixtures/build-document-record';
import { ASSINAFY_DOCUMENT_SELECTION } from 'src/data/assinafy-document-selection';

it('selects every AssinafyDocumentRecord field', () => {
  expect(Object.keys(ASSINAFY_DOCUMENT_SELECTION).toSorted()).toEqual(Object.keys(buildDocumentRecord()).toSorted());
  expect(Object.entries(ASSINAFY_DOCUMENT_SELECTION).filter(([, selected]) => !selected)).toEqual([]);
  expect(ASSINAFY_DOCUMENT_SELECTION.signedDocument).toEqual({ fileId: true, label: true, url: true });
});
