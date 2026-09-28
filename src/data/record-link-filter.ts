import { type CoreSchema } from 'twenty-client-sdk/core';

// Record ids are unique across objects, so one filter finds the documents linked to a person, company or opportunity.
export const recordLinkFilter = (recordId: string): CoreSchema.AssinafyDocumentFilterInput => ({
  or: [{ personId: { eq: recordId } }, { companyId: { eq: recordId } }, { opportunityId: { eq: recordId } }],
});
