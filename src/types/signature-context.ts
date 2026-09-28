import { type Contact } from 'src/types/contact';
import { type CredentialKind } from 'src/types/credential-kind';
import { type CrmObjectName } from 'src/types/crm-object-name';
import { type PdfAttachment } from 'src/types/pdf-attachment';
import { type RecentSend } from 'src/types/recent-send';
import { type TemplateSummary } from 'src/types/template-summary';

export type SignatureContext = {
  record: { objectNameSingular: CrmObjectName; id: string; name: string };
  // Null when no usable Assinafy credential exists; templates is then empty.
  sendingAs: { kind: CredentialKind; accountId: string; accountName: string } | null;
  // Whether documents from this workspace are refreshed in the background (API key or shared connection).
  backgroundSyncAvailable: boolean;
  templates: TemplateSummary[];
  attachments: PdfAttachment[];
  suggestedSigners: Contact[];
  additionalContacts: Contact[];
  // Documents of the record created in the last hour that may have reached the signers (newest first). A send whose
  // answer was lost leaves one here, so a new flow asks the member to check it before sending again.
  recentSends: RecentSend[];
};
