import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { findDocumentRecord, pdfRequest, prepare, readPendingUploads, waitUntilProcessed } from 'src/__tests__/e2e/e2e-flows';
import {
  clearApiKey,
  type E2eApp,
  findE2eApp,
  frontEndToken,
  useSimulatorApiKey,
} from 'src/__tests__/e2e/e2e-twenty';
import { graphql } from 'src/__tests__/e2e/graphql';
import { poll } from 'src/__tests__/e2e/poll';
import { simulator } from 'src/__tests__/e2e/simulator-client';
import { createCrmFixtures, type CrmFixtures } from 'src/__tests__/integration/crm-fixtures';
import { callRoute, findLogicFunctionId, runCleanup } from 'src/__tests__/integration/twenty-api';
import { SEND_FOR_SIGNATURE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

type WorkflowOutput = {
  ok: boolean;
  documentRecordId: string | null;
  status: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

const cleanup: Array<() => Promise<unknown>> = [];
let app: E2eApp;
let crm: CrmFixtures;
let token: string;

// A draft workflow whose manual trigger runs the app's workflow action with `input`.
const createWorkflow = async (name: string, input: Record<string, unknown>): Promise<string> => {
  const { createWorkflow: workflow } = await graphql<{ createWorkflow: { id: string } }>(
    'graphql',
    'mutation ($data: WorkflowCreateInput!) { createWorkflow(data: $data) { id } }',
    { data: { name } },
  );
  cleanup.push(() => graphql('graphql', 'mutation ($id: UUID!) { destroyWorkflow(id: $id) { id } }', { id: workflow.id }));

  const { workflowVersions } = await poll(
    () =>
      graphql<{ workflowVersions: { edges: Array<{ node: { id: string } }> } }>(
        'graphql',
        'query ($id: UUID!) { workflowVersions(filter: { workflowId: { eq: $id } }) { edges { node { id } } } }',
        { id: workflow.id },
      ),
    ({ workflowVersions: versions }) => versions.edges.length > 0,
    { timeoutMs: 20_000, label: 'the draft workflow version' },
  );
  const workflowVersionId = workflowVersions.edges[0]?.node.id ?? '';

  await graphql(
    'graphql',
    'mutation ($input: UpdateWorkflowVersionTriggerInput!) { updateWorkflowVersionTrigger(input: $input) { trigger } }',
    { input: { workflowVersionId, trigger: { name: 'Manual', type: 'MANUAL', settings: { outputSchema: {} } } } },
  );
  await graphql(
    'graphql',
    'mutation ($input: CreateWorkflowVersionStepInput!) { createWorkflowVersionStep(input: $input) { stepsDiff } }',
    {
      input: {
        workflowVersionId,
        stepType: 'LOGIC_FUNCTION',
        parentStepId: 'trigger',
        defaultSettings: {
          input: {
            logicFunctionId: findLogicFunctionId(app, SEND_FOR_SIGNATURE_WORKFLOW_ACTION_UNIVERSAL_IDENTIFIER),
            logicFunctionInput: input,
          },
        },
      },
    },
  );
  return workflowVersionId;
};

// Runs the version as the member and returns the action's output once the run ends.
const runWorkflow = async (workflowVersionId: string): Promise<WorkflowOutput> => {
  const { runWorkflowVersion } = await graphql<{ runWorkflowVersion: { workflowRunId: string } }>(
    'graphql',
    'mutation ($input: RunWorkflowVersionInput!) { runWorkflowVersion(input: $input) { workflowRunId } }',
    { input: { workflowVersionId } },
  );
  type Run = {
    status: string;
    state: { stepInfos: Record<string, { status: string; result?: WorkflowOutput; error?: string }> } | null;
  };
  const { workflowRuns } = await poll(
    () =>
      graphql<{ workflowRuns: { edges: Array<{ node: Run }> } }>(
        'graphql',
        'query ($id: UUID!) { workflowRuns(filter: { id: { eq: $id } }) { edges { node { status state } } } }',
        { id: runWorkflowVersion.workflowRunId },
      ),
    ({ workflowRuns: runs }) => ['COMPLETED', 'FAILED'].includes(runs.edges[0]?.node.status ?? ''),
    { timeoutMs: 180_000, intervalMs: 2_000, label: 'the workflow run to end' },
  );
  const run = workflowRuns.edges[0]?.node;
  const step = Object.entries(run?.state?.stepInfos ?? {}).find(([id]) => id !== 'trigger')?.[1];
  if (!step?.result) throw new Error(`The workflow run ended ${run?.status} without an action result: ${step?.error ?? 'no step'}`);
  return step.result;
};

// Workflow steps run in Twenty's worker, whose workspace cache memoizes reads for 10 s (MEMOIZER_TTL_MS): for that long
// it may still hand the action the API key value an earlier scenario cleared, and the action answers NOT_CONNECTED
// before any Assinafy call, or the new key with the cleared account id, and the action answers ACCOUNT_REQUIRED from the
// workspace lookup (the sandbox key reaches several workspaces), before any upload. Such a run changes nothing, so it is
// run again until the worker sees both variables.
const STALE_VARIABLE_CODES = new Set(['NOT_CONNECTED', 'ACCOUNT_REQUIRED']);
const runWorkflowOnceConnected = (workflowVersionId: string): Promise<WorkflowOutput> =>
  poll(
    () => runWorkflow(workflowVersionId),
    (output) => !STALE_VARIABLE_CODES.has(output.errorCode ?? ''),
    { timeoutMs: 60_000, intervalMs: 2_000, label: 'the workflow worker to see the API key' },
  );

beforeAll(async () => {
  app = await findE2eApp();
  crm = await createCrmFixtures(cleanup);
  token = await frontEndToken(app);
  await useSimulatorApiKey(app);
});

afterAll(async () => {
  await runCleanup(cleanup);
  await clearApiKey(app);
});

const baseInput = () => ({
  attachment: crm.pdfAttachment.id,
  signers: [crm.person.id],
  person: crm.person.id,
  expiresInDays: 1,
});

describe('workflow action', () => {
  it('sends the attached PDF to the CRM signer and returns the created record', async () => {
    const versionId = await createWorkflow('Assinafy E2E', { ...baseInput(), name: 'Fluxo E2E', maxCredits: 1000 });
    const mark = await simulator.mark();

    const output = await runWorkflowOnceConnected(versionId);

    expect(output).toMatchObject({ ok: true, status: 'PENDING_SIGNATURE', documentRecordId: expect.any(String), errorCode: null });
    const record = await findDocumentRecord(output.documentRecordId ?? '');
    expect(record).toMatchObject({ name: 'Fluxo E2E', status: 'PENDING_SIGNATURE', personId: crm.person.id, signerCount: 1 });
    const log = await simulator.logSince(mark);
    expect(log.filter(({ method, path }) => method === 'POST' && path === `/v1/documents/${record?.assinafyDocumentId}/assignments`)).toEqual([
      expect.objectContaining({ status: 200 }),
    ]);

    expect(await callRoute('/s/assinafy/documents/cancel', token, { documentRecordId: output.documentRecordId })).toMatchObject({
      ok: true,
      status: 'CANCELLED',
    });
  });

  it('refuses a send above maxCredits, sends nothing and discards the upload (or leaves it to the purge)', async () => {
    // WhatsApp validation is paid in credits, so a ceiling of 0 (plan documents only) refuses it: with COST_LIMIT_EXCEEDED
    // when the sandbox balance covers it, with INSUFFICIENT_RESOURCES before that check when it does not.
    const quote = await prepare(token, {
      ...pdfRequest(crm, 'Cotação WhatsApp E2E'),
      signers: [{ name: 'Ana Integração', phone: '+5511987654321', verificationMethod: 'Whatsapp', notificationMethod: 'Whatsapp' }],
    });
    expect(quote.estimate.totalCredits).toBeGreaterThan(0);
    await waitUntilProcessed(quote.assinafyDocumentId ?? '');
    expect(
      await callRoute('/s/assinafy/discard', token, { assinafyDocumentId: quote.assinafyDocumentId, accountId: quote.accountId }),
    ).toEqual({ ok: true });

    const versionId = await createWorkflow('Assinafy E2E limite', { ...baseInput(), verificationMethod: 'WhatsApp', maxCredits: 0 });
    const mark = await simulator.mark();

    const output = await runWorkflowOnceConnected(versionId);

    expect(output).toMatchObject({
      ok: false,
      errorCode: quote.estimate.sufficient ? 'COST_LIMIT_EXCEEDED' : 'INSUFFICIENT_RESOURCES',
      documentRecordId: null,
    });
    const log = await simulator.logSince(mark);
    expect(log.filter(({ method, path }) => method === 'POST' && path.endsWith('/assignments'))).toEqual([]);
    const [upload] = log.filter(({ method, path }) => method === 'POST' && /^\/v1\/accounts\/[^/]+\/documents$/.test(path));
    expect(upload).toMatchObject({ status: 200 });
    const deletes = log.filter(({ method }) => method === 'DELETE');
    expect(deletes).toHaveLength(1);
    const uploadId = /^\/v1\/documents\/([^/]+)$/.exec(deletes[0]?.path ?? '')?.[1] ?? '';
    const pending = (await readPendingUploads(app.id)).map(({ documentId }) => documentId);
    // Deleted right away, or (400: Assinafy is still processing it) kept on the pending-upload list for the purge.
    expect([
      { status: 200, pending: false },
      { status: 400, pending: true },
    ]).toContainEqual({ status: deletes[0]?.status, pending: pending.includes(uploadId) });
  });
});
