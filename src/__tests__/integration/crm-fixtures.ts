import { STANDARD_OBJECT } from 'twenty-sdk/define';

import { buildPdf } from 'src/__tests__/fixtures/build-pdf';
import { coreClient, metadataClient, USER_TOKEN } from 'src/__tests__/integration/twenty-api';

export type CrmFixtures = {
  company: { id: string };
  // The signer: works at the company, has a Brazilian mobile number and the PDF attachment.
  person: { id: string; email: string };
  colleague: { id: string; email: string };
  opportunity: { id: string };
  pdf: Buffer;
  pdfAttachment: { id: string; name: string; uploadedFileId: string };
  // Not a PDF: the send flow must not offer it, and /prepare refuses it after downloading it.
  textAttachment: { id: string };
};

const ATTACHMENT_FILE_FIELD = STANDARD_OBJECT.attachment.fields.file.universalIdentifier;

// Everything is created as the seeded member; `cleanup` receives each deletion as soon as the record exists.
export const createCrmFixtures = async (cleanup: Array<() => Promise<unknown>>): Promise<CrmFixtures> => {
  const core = coreClient(USER_TOKEN);
  const metadata = metadataClient(USER_TOKEN);
  const runId = crypto.randomUUID().slice(0, 8);
  // The seeded workspace runs a workflow on every new email that re-attaches the person to the company owning the email
  // domain (creating one if needed). A domain unique to the run and owned by this company keeps the people here; the
  // company the workflow still creates for the domain is swept by the suites' global teardown (destroyFixtureCompanies).
  const emailDomain = `assinafy-${runId}.invalid`;

  const { createCompany: company } = await core.mutation({
    createCompany: {
      __args: {
        data: { name: `Assinafy integration ${runId}`, domainName: { primaryLinkUrl: `https://${emailDomain}` } },
      },
      id: true,
    },
  });
  cleanup.push(() => core.mutation({ destroyCompany: { __args: { id: company!.id }, id: true } }));

  const createPerson = async (firstName: string, phone?: string) => {
    const email = `${firstName.toLowerCase()}@${emailDomain}`;
    const { createPerson: person } = await core.mutation({
      createPerson: {
        __args: {
          data: {
            name: { firstName, lastName: 'Integração' },
            emails: { primaryEmail: email },
            companyId: company!.id,
            ...(phone && {
              phones: { primaryPhoneNumber: phone, primaryPhoneCallingCode: '+55', primaryPhoneCountryCode: 'BR' },
            }),
          },
        },
        id: true,
      },
    });
    cleanup.push(() => core.mutation({ destroyPerson: { __args: { id: person!.id }, id: true } }));
    return { id: person!.id, email };
  };

  // Created in this order: the company's contacts are listed oldest first.
  const person = await createPerson('Ana', '(11) 98765-4321');
  const colleague = await createPerson('Bruno');

  const { createOpportunity: opportunity } = await core.mutation({
    createOpportunity: {
      __args: { data: { name: `Contract ${runId}`, companyId: company!.id, pointOfContactId: person.id } },
      id: true,
    },
  });
  cleanup.push(() => core.mutation({ destroyOpportunity: { __args: { id: opportunity!.id }, id: true } }));

  const attach = async (fileBuffer: Buffer, name: string) => {
    const uploaded = await metadata.uploadFile({ fileBuffer, filename: name, fieldMetadataUniversalIdentifier: ATTACHMENT_FILE_FIELD });
    const { createAttachment: attachment } = await core.mutation({
      createAttachment: {
        __args: { data: { name, file: [{ fileId: uploaded.id, label: name }], targetPersonId: person.id } },
        id: true,
      },
    });
    cleanup.push(() => core.mutation({ destroyAttachment: { __args: { id: attachment!.id }, id: true } }));
    return { id: attachment!.id, name, uploadedFileId: uploaded.id };
  };

  const pdf = buildPdf();
  const pdfAttachment = await attach(pdf, 'Contract.pdf');
  const textAttachment = await attach(Buffer.from('meeting notes\n'), 'notes.txt');

  return {
    company: { id: company!.id },
    person,
    colleague,
    opportunity: { id: opportunity!.id },
    pdf,
    pdfAttachment,
    textAttachment: { id: textAttachment.id },
  };
};
