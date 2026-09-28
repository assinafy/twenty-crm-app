import { beforeAll, describe, expect, it } from 'vitest';

import { E2E_TWENTY_URL, SIM_URL, SIMULATION_CRON_PATTERN } from 'src/__tests__/e2e/e2e-constants';
import { type E2eApp, findE2eApp, runHealthCheck } from 'src/__tests__/e2e/e2e-twenty';
import { graphql } from 'src/__tests__/e2e/graphql';
import { appRows, appUniversalIdentifiers } from 'src/__tests__/e2e/app-rows';
import { USER_TOKEN } from 'src/__tests__/integration/twenty-api';
import * as ids from 'src/constants/universal-identifiers';

let app: E2eApp;

beforeAll(async () => {
  app = await findE2eApp();
});

describe('install of the simulation build', () => {
  it('installs the app with its object, relation fields, view, navigation item and record page tabs', async () => {
    expect(app.objects).toContainEqual(
      expect.objectContaining({ universalIdentifier: ids.ASSINAFY_DOCUMENT_OBJECT_UNIVERSAL_IDENTIFIER, nameSingular: 'assinafyDocument' }),
    );
    expect(await appUniversalIdentifiers(app.id, 'fieldMetadata')).toEqual(
      expect.arrayContaining([
        ids.PERSON_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER,
        ids.COMPANY_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER,
        ids.OPPORTUNITY_ASSINAFY_DOCUMENTS_FIELD_UNIVERSAL_IDENTIFIER,
        ids.PERSON_FIELD_UNIVERSAL_IDENTIFIER,
        ids.COMPANY_FIELD_UNIVERSAL_IDENTIFIER,
        ids.OPPORTUNITY_FIELD_UNIVERSAL_IDENTIFIER,
        ids.REQUEST_ID_FIELD_UNIVERSAL_IDENTIFIER,
      ]),
    );
    expect(await appUniversalIdentifiers(app.id, 'view')).toContain(ids.DOCUMENTS_VIEW_UNIVERSAL_IDENTIFIER);
    expect(await appUniversalIdentifiers(app.id, 'navigationMenuItem')).toEqual([ids.DOCUMENTS_NAVIGATION_MENU_ITEM_UNIVERSAL_IDENTIFIER]);
    expect((await appUniversalIdentifiers(app.id, 'pageLayoutTab')).toSorted()).toEqual(
      expect.arrayContaining([
        ids.PERSON_SIGNATURES_TAB_UNIVERSAL_IDENTIFIER,
        ids.COMPANY_SIGNATURES_TAB_UNIVERSAL_IDENTIFIER,
        ids.OPPORTUNITY_SIGNATURES_TAB_UNIVERSAL_IDENTIFIER,
        ids.DOCUMENT_STATUS_TAB_UNIVERSAL_IDENTIFIER,
      ]),
    );
    expect(await appUniversalIdentifiers(app.id, 'pageLayoutWidget')).toEqual(
      expect.arrayContaining([
        ids.PERSON_SIGNATURES_WIDGET_UNIVERSAL_IDENTIFIER,
        ids.COMPANY_SIGNATURES_WIDGET_UNIVERSAL_IDENTIFIER,
        ids.OPPORTUNITY_SIGNATURES_WIDGET_UNIVERSAL_IDENTIFIER,
        ids.DOCUMENT_PANEL_WIDGET_UNIVERSAL_IDENTIFIER,
      ]),
    );
  });

  it('registers the command menu items and the timeline activity types', async () => {
    expect((await appUniversalIdentifiers(app.id, 'commandMenuItem')).toSorted()).toEqual(
      [
        ids.SEND_FOR_SIGNATURE_PERSON_COMMAND_UNIVERSAL_IDENTIFIER,
        ids.SEND_FOR_SIGNATURE_COMPANY_COMMAND_UNIVERSAL_IDENTIFIER,
        ids.SEND_FOR_SIGNATURE_OPPORTUNITY_COMMAND_UNIVERSAL_IDENTIFIER,
      ].toSorted(),
    );
    expect((await appUniversalIdentifiers(app.id, 'timelineActivityType')).toSorted()).toEqual(
      [
        ids.PERSON_SIGNATURE_REQUEST_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
        ids.COMPANY_SIGNATURE_REQUEST_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
        ids.OPPORTUNITY_SIGNATURE_REQUEST_TIMELINE_ACTIVITY_TYPE_UNIVERSAL_IDENTIFIER,
      ].toSorted(),
    );
  });

  it('installs every logic function, the health check and the (parked) sync cron', async () => {
    const expected = [
      ids.GET_SIGNATURE_CONTEXT_ROUTE_UNIVERSAL_IDENTIFIER,
      ids.GET_SIGNATURE_CONTEXT_TOOL_UNIVERSAL_IDENTIFIER,
      ids.PREPARE_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER,
      ids.SEND_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER,
      ids.DISCARD_UPLOAD_ROUTE_UNIVERSAL_IDENTIFIER,
      ids.REFRESH_DOCUMENT_ROUTE_UNIVERSAL_IDENTIFIER,
      ids.RESEND_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER,
      ids.CANCEL_SIGNATURE_REQUEST_ROUTE_UNIVERSAL_IDENTIFIER,
      ids.PROPOSE_SIGNATURE_REQUEST_TOOL_UNIVERSAL_IDENTIFIER,
      ids.GET_DOCUMENT_STATUS_TOOL_UNIVERSAL_IDENTIFIER,
      ids.SEND_FOR_SIGNATURE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER,
      ids.SYNC_DOCUMENTS_CRON_UNIVERSAL_IDENTIFIER,
      ids.HEALTH_CHECK_UNIVERSAL_IDENTIFIER,
      ids.ON_DISCONNECT_UNIVERSAL_IDENTIFIER,
      ids.UNINSTALL_UNIVERSAL_IDENTIFIER,
    ];
    expect(app.logicFunctions.map(({ universalIdentifier }) => universalIdentifier).toSorted()).toEqual(expected.toSorted());
    expect(app.healthCheckLogicFunctionId).toBe(
      app.logicFunctions.find(({ universalIdentifier }) => universalIdentifier === ids.HEALTH_CHECK_UNIVERSAL_IDENTIFIER)?.id,
    );

    const { findManyLogicFunctions } = await graphql<{
      findManyLogicFunctions: Array<{ universalIdentifier: string; cronTriggerSettings: { pattern?: string } | null }>;
    }>('metadata', '{ findManyLogicFunctions { universalIdentifier cronTriggerSettings } }');
    expect(
      findManyLogicFunctions.find(({ universalIdentifier }) => universalIdentifier === ids.SYNC_DOCUMENTS_CRON_UNIVERSAL_IDENTIFIER)
        ?.cronTriggerSettings,
    ).toMatchObject({ pattern: SIMULATION_CRON_PATTERN });
  });

  it('serves the four front component bundles and the shared-dependencies bundle', async () => {
    expect(app.frontComponents.map(({ universalIdentifier }) => universalIdentifier).toSorted()).toEqual(
      [
        ids.SEND_FOR_SIGNATURE_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
        ids.RECORD_SIGNATURES_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
        ids.DOCUMENT_PANEL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
        ids.SIGNATURE_REQUEST_TOOL_CALL_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
      ].toSorted(),
    );
    const headers = { authorization: `Bearer ${USER_TOKEN}` };
    for (const component of app.frontComponents) {
      const bundle = await fetch(`${E2E_TWENTY_URL}/rest/front-components/${component.id}/${component.builtComponentChecksum}.js`, { headers });
      expect({ component: component.universalIdentifier, status: bundle.status }).toEqual({ component: component.universalIdentifier, status: 200 });
      expect((await bundle.text()).length).toBeGreaterThan(100);
    }
    const [{ frontComponentSharedDependenciesChecksum: checksum }] = app.frontComponents as [E2eApp['frontComponents'][number]];
    expect(checksum).toEqual(expect.any(String));
    const shared = await fetch(`${E2E_TWENTY_URL}/rest/front-component-shared-dependencies/${app.id}/${checksum}.js`, { headers });
    expect(shared.status).toBe(200);
    expect((await shared.text()).length).toBeGreaterThan(1_000);
  });

  it('declares the Assinafy connection provider, pointed at the simulator, with no OAuth client configured yet', async () => {
    const { applicationConnectionProviders } = await graphql<{
      applicationConnectionProviders: Array<{ name: string; oauth: { scopes: string[]; isClientCredentialsConfigured: boolean } }>;
    }>('metadata', 'query ($id: UUID!) { applicationConnectionProviders(applicationId: $id) { name oauth { scopes isClientCredentialsConfigured } } }', {
      id: app.id,
    });
    expect(applicationConnectionProviders).toEqual([
      {
        name: 'assinafy',
        oauth: {
          scopes: ['documents:read', 'documents:write', 'templates:read', 'templates:write', 'account:read', 'offline_access'],
          isClientCredentialsConfigured: false,
        },
      },
    ]);
    const [provider] = await appRows<{ oauthConfig: Record<string, unknown> }>(app.id, 'connectionProvider', '"oauthConfig"');
    expect(provider?.oauthConfig).toMatchObject({
      authorizationEndpoint: `${SIM_URL}/oauth/authorize`,
      tokenEndpoint: `${SIM_URL}/v1/oauth/token`,
      usePkce: true,
      tokenRequestContentType: 'form-urlencoded',
    });
    expect(provider?.oauthConfig.revokeEndpoint ?? null).toBeNull();
  });

  it('the health check warns in pt-BR that Assinafy is not connected', async () => {
    expect(await runHealthCheck(app)).toEqual({
      status: 'WARNING',
      title: 'A Assinafy não está conectada ao workspace',
      description: expect.stringContaining('defina uma chave de API da Assinafy'),
      action: { label: 'Definir chave de API' },
    });
  });
});
