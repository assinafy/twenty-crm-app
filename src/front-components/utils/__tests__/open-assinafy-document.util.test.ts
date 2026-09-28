import { openSidePanelPage } from 'twenty-sdk/front-component';
import { describe, expect, it, vi } from 'vitest';

import { openAssinafyDocument } from 'src/front-components/utils/open-assinafy-document.util';

vi.mock('twenty-sdk/front-component', () => ({
  openSidePanelPage: vi.fn<() => Promise<void>>(),
  SidePanelPages: { ViewRecord: 'ViewRecord' },
}));

describe('openAssinafyDocument', () => {
  it('opens the Assinafy document record in the side panel', () => {
    void openAssinafyDocument('doc-1');

    expect(openSidePanelPage).toHaveBeenCalledExactlyOnceWith({
      page: 'ViewRecord',
      recordId: 'doc-1',
      objectNameSingular: 'assinafyDocument',
    });
  });
});
