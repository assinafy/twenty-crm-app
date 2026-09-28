import { type CrmObjectName } from 'src/types/crm-object-name';

export type CrmRecord = {
  objectNameSingular: CrmObjectName;
  id: string;
  name: string;
  // Opportunity: its point of contact; Person: itself; Company: null.
  primaryContactPersonId: string | null;
  // Company whose people are offered as additional signers (company itself, a person's or an opportunity's company).
  companyId: string | null;
};
