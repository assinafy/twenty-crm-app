import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  API_KEY,
  coreClient,
  findInstalledApp,
  HAS_WORKSPACE_API_KEY,
  WORKSPACE_API_KEY,
  type InstalledApp,
  metadataClient,
  runCleanup,
  USER_TOKEN,
} from 'src/__tests__/integration/twenty-api';
import { DOCUMENT_STATUS } from 'src/constants/document-status';
import {
  ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
  COMPANY_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER,
  OPPORTUNITY_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER,
  PERSON_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER,
} from 'src/constants/universal-identifiers';

const NOT_WRITABLE = (field: string) => new RegExp(`field "${field}" on "assinafyDocument" is not writable through the API`);

const appOnly = (type: string) => ({ type, writability: 'APPLICATION' });
const relationTo = (target: string, reverseFieldUniversalIdentifier: string) => ({
  ...appOnly('RELATION'),
  // Deleting a person, company or opportunity must keep its signature records and only clear the link.
  settings: { relationType: 'MANY_TO_ONE', onDelete: 'SET_NULL' },
  relation: {
    type: 'MANY_TO_ONE',
    targetObjectMetadata: { nameSingular: target },
    targetFieldMetadata: { universalIdentifier: reverseFieldUniversalIdentifier },
  },
});

const cleanup: Array<() => Promise<unknown>> = [];
let app: InstalledApp;

beforeAll(async () => {
  app = await findInstalledApp();
});

afterAll(() => runCleanup(cleanup));

describe('installed schema', () => {
  it('installs the app with the assinafyDocument object', () => {
    expect(app.objects.map((object) => object.universalIdentifier)).toEqual([
      ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER,
    ]);
    expect(app.logicFunctions.length).toBeGreaterThan(0);
  });

  it('creates the object, its fields, relations and the unique requestId index as designed', async () => {
    const objectId = app.objects[0]!.id;
    const { object } = await metadataClient(API_KEY).query({
      object: {
        __args: { id: objectId },
        nameSingular: true,
        isUICreatable: true,
        writability: true,
        fieldsList: {
          id: true,
          name: true,
          type: true,
          writability: true,
          settings: true,
          relation: { type: true, targetObjectMetadata: { nameSingular: true }, targetFieldMetadata: { universalIdentifier: true } },
        },
        indexMetadataList: { isUnique: true, indexFieldMetadataList: { fieldMetadataId: true } },
      },
    });
    const fields = Object.fromEntries(object.fieldsList.map((field) => [field.name, field]));

    expect(object).toMatchObject({ nameSingular: 'assinafyDocument', isUICreatable: false, writability: 'OPEN' });
    expect(fields).toMatchObject({
      name: { type: 'TEXT', writability: 'OPEN' },
      status: appOnly('SELECT'),
      assinafyDocumentId: appOnly('TEXT'),
      assinafyAccountId: appOnly('TEXT'),
      assinafyAssignmentId: appOnly('TEXT'),
      requestId: appOnly('TEXT'),
      templateName: appOnly('TEXT'),
      signerCount: appOnly('NUMBER'),
      signedCount: appOnly('NUMBER'),
      signers: appOnly('RAW_JSON'),
      sentAt: appOnly('DATE_TIME'),
      completedAt: appOnly('DATE_TIME'),
      expiresAt: appOnly('DATE_TIME'),
      lastSyncedAt: appOnly('DATE_TIME'),
      declineReason: appOnly('TEXT'),
      lastError: appOnly('TEXT'),
      signedDocument: appOnly('FILES'),
      person: relationTo('person', PERSON_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER),
      company: relationTo('company', COMPANY_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER),
      opportunity: relationTo('opportunity', OPPORTUNITY_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER),
    });

    const requestIdFieldId = fields.requestId?.id;
    expect(
      object.indexMetadataList.some(
        (index) =>
          index.isUnique &&
          index.indexFieldMetadataList.length === 1 &&
          index.indexFieldMetadataList[0]?.fieldMetadataId === requestIdFieldId,
      ),
    ).toBe(true);
  });
});

describe.each([
  ['a workspace member', USER_TOKEN],
  ...(HAS_WORKSPACE_API_KEY ? [['the workspace API key', WORKSPACE_API_KEY]] : []),
])('assinafyDocument writes by %s', (_caller, token) => {
  const core = coreClient(token);

  const createNameOnly = async () => {
    const { createAssinafyDocument: created } = await core.mutation({
      createAssinafyDocument: { __args: { data: { name: 'Created outside the app' } }, id: true, status: true },
    });
    cleanup.push(() => core.mutation({ destroyAssinafyDocument: { __args: { id: created!.id }, id: true } }));
    return created!;
  };

  it('cannot create a record carrying app-only fields', async () => {
    await expect(
      core.mutation({
        createAssinafyDocument: { __args: { data: { name: 'Forged', status: DOCUMENT_STATUS.CERTIFICATED } }, id: true },
      }),
    ).rejects.toThrow(NOT_WRITABLE('status'));
    await expect(
      core.mutation({
        createAssinafyDocument: { __args: { data: { name: 'Forged', requestId: 'forged-request' } }, id: true },
      }),
    ).rejects.toThrow(NOT_WRITABLE('requestId'));
  });

  // The object stays OPEN so roles may delete records; only the Twenty UI hides creation (isUICreatable false).
  it('may create and rename a record with only a name, which carries no status', async () => {
    const created = await createNameOnly();
    expect(created.status).toBeNull();

    const { updateAssinafyDocument: renamed } = await core.mutation({
      updateAssinafyDocument: { __args: { id: created.id, data: { name: 'Renamed' } }, name: true },
    });
    expect(renamed?.name).toBe('Renamed');
  });

  it('cannot set app-only fields or relations on an existing record', async () => {
    const created = await createNameOnly();

    await expect(
      core.mutation({
        updateAssinafyDocument: { __args: { id: created.id, data: { status: DOCUMENT_STATUS.CERTIFICATED } }, id: true },
      }),
    ).rejects.toThrow(NOT_WRITABLE('status'));
    await expect(
      core.mutation({
        updateAssinafyDocument: { __args: { id: created.id, data: { signedCount: 1, lastError: null } }, id: true },
      }),
    ).rejects.toThrow(/is not writable through the API/);
    await expect(
      core.mutation({
        updateAssinafyDocument: { __args: { id: created.id, data: { personId: crypto.randomUUID() } }, id: true },
      }),
    ).rejects.toThrow(NOT_WRITABLE('person'));
  });

  it('may delete a record', async () => {
    const { createAssinafyDocument: created } = await core.mutation({
      createAssinafyDocument: { __args: { data: { name: 'Deleted by its creator' } }, id: true },
    });

    const { destroyAssinafyDocument: destroyed } = await core.mutation({
      destroyAssinafyDocument: { __args: { id: created!.id }, id: true },
    });
    expect(destroyed?.id).toBe(created!.id);
  });
});

// Twenty stores unset TEXT fields as NULL but the GraphQL API returns them as '': code reading records must treat ''
// as absent.
it('reads unset TEXT fields back as empty strings', async () => {
  const core = coreClient(USER_TOKEN);
  const { createAssinafyDocument: created } = await core.mutation({
    createAssinafyDocument: {
      __args: { data: { name: 'Without Assinafy data' } },
      id: true,
      assinafyDocumentId: true,
      assinafyAccountId: true,
      requestId: true,
      lastError: true,
      sentAt: true,
    },
  });
  cleanup.push(() => core.mutation({ destroyAssinafyDocument: { __args: { id: created!.id }, id: true } }));

  expect(created).toMatchObject({ assinafyDocumentId: '', assinafyAccountId: '', requestId: '', lastError: '', sentAt: null });

  const { assinafyDocuments } = await core.query({
    assinafyDocuments: {
      __args: { filter: { id: { eq: created!.id }, assinafyDocumentId: { is: 'NULL' } } },
      edges: { node: { id: true } },
    },
  });
  expect(assinafyDocuments?.edges.map(({ node }) => node.id)).toEqual([created!.id]);
});
