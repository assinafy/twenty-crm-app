import { type DocumentStatus } from 'src/types/document-status';

// A document sent, or possibly sent, from the record shortly before the send flow opened.
export type RecentSend = {
  documentRecordId: string;
  name: string | null;
  status: DocumentStatus | null;
};
