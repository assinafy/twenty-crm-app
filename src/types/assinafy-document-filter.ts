import { type DocumentStatus } from 'src/types/document-status';

type FilterIs = 'NULL' | 'NOT_NULL';
type TextFilter = { eq?: string; is?: FilterIs };
type DateTimeFilter = { gte?: string; lt?: string; is?: FilterIs };

// The assinafyDocument filters the app uses. Declared here instead of imported from the generated client so the code
// also typechecks against the fresh-install client stub; the generated client checks it against
// AssinafyDocumentFilterInput wherever it is passed to a query.
export type AssinafyDocumentFilter = {
  id?: { eq?: string };
  name?: TextFilter;
  status?: { eq?: DocumentStatus; neq?: DocumentStatus; in?: DocumentStatus[]; is?: FilterIs };
  assinafyDocumentId?: TextFilter;
  requestId?: TextFilter;
  sentAt?: DateTimeFilter;
  createdAt?: DateTimeFilter;
  updatedAt?: DateTimeFilter;
  personId?: { eq?: string };
  companyId?: { eq?: string };
  opportunityId?: { eq?: string };
  and?: AssinafyDocumentFilter[];
  or?: AssinafyDocumentFilter[];
};
