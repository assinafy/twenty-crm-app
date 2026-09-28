import { openSidePanelPage, SidePanelPages } from 'twenty-sdk/front-component';

export const openAssinafyDocument = (documentRecordId: string) =>
  openSidePanelPage({ page: SidePanelPages.ViewRecord, recordId: documentRecordId, objectNameSingular: 'assinafyDocument' });
