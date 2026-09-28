import { type AssinafyDocumentFilter } from 'src/types/assinafy-document-filter';

// Record ids are unique across objects, so one filter finds the documents linked to a person, company or opportunity.
export const recordLinkFilter = (recordId: string): AssinafyDocumentFilter => ({
  or: [{ personId: { eq: recordId } }, { companyId: { eq: recordId } }, { opportunityId: { eq: recordId } }],
});
