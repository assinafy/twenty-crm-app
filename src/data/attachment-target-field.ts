import { type CrmObjectName } from 'src/types/crm-object-name';

// Attachment column linking it to a record of each CRM object.
export const ATTACHMENT_TARGET_FIELD = {
  person: 'targetPersonId',
  company: 'targetCompanyId',
  opportunity: 'targetOpportunityId',
} as const satisfies Record<CrmObjectName, string>;
