# Developer and operator guide

How to build, test, release and reason about Assinafy for Twenty. The product documentation for workspace admins and members is README.md; the rules every change follows are in Contributing rules.

## Prerequisites

- Node.js 24 LTS (`.nvmrc` pins 24; `package.json` requires `^24.5.0`).
- Corepack, which provides Yarn 4.18.1 from the `packageManager` field: `corepack enable`.
- Docker, for the local Twenty servers.
- For the optional live suite: an Assinafy sandbox API key.
- For OAuth testing: an Assinafy OAuth application (see README.md, Configuração → 1. Administrador do servidor). Assinafy accepts only `https://` redirect URIs, so testing OAuth against a local server needs an https tunnel in front of it; the API key path needs nothing extra.

## Install

```bash
corepack enable
yarn install --immutable
```

## Contributing rules

The source lives in https://github.com/assinafy/twenty-crm-app and is published to npm as `@assinafy/twenty-app` by `.github/workflows/publish.yml` when a version tag is pushed (see Publishing). Read README.md, this guide and the relevant source and tests before changing behavior; the code is the source of truth. Tagging, publishing, and syncing to or uninstalling from a production workspace are maintainer release steps.

### Toolchain and code layout

- Node.js 24 LTS, Yarn 4.18 through Corepack (`yarn install --immutable`), TypeScript in strict mode, `twenty-sdk`, `twenty-client-sdk` and `twenty-ui` 2.42.0, `@assinafy/sdk` 2.4.2, vitest and oxlint. Do not add a dependency for what a few lines or an installed package already do.
- One export per file: one entity (`define*` default export), function, component, class or type. Constants files in `src/constants/` group related constants. Keep the folder responsibilities and file suffixes of Architecture → Folders (`*.object.ts`, `*.logic-function.ts`, `*.handler.ts`, `*.service.ts`, `*.util.ts`, `*.front-component.tsx`, …), and import through the `src/` path alias.
- Reuse what exists: the strict parsers and readers in `src/utils/`, `validateSigners` (shared by the front end and the server), `toAppError`, `toAppResult`, `AppFailure`, the credential resolvers in `src/assinafy-client/` and the record mappers in `src/data/`. Check every caller before changing a shared function.
- Universal identifiers are UUID v4 values in `src/constants/universal-identifiers.ts`. Never change or reuse one; scaffold new entities with `yarn twenty dev:add` or generate a fresh UUID v4.
- Front components are rendering shells. Flow logic, validation and message selection go in pure modules under `src/front-components/utils/`, where they are unit-tested.
- Logic functions return stable error codes, and the front end maps them to pt-BR messages in `src/front-components/utils/get-error-message.util.ts`. Add the code and its message there whenever a handler can produce or store a new one.
- User-facing text is Brazilian Portuguese source text (see User interface language); identifiers, API values, error codes, comments and log lines stay in English.

### Tests

- Unit tests (`*.test.ts`) live in `__tests__` folders next to the code. Integration suites (`*.integration-test.ts`, Twenty test server) live in `src/__tests__/integration/`, the live suite (`*.live-test.ts`, Assinafy sandbox) in `src/__tests__/live/` and the end-to-end suite in `src/__tests__/e2e/`.
- Every behavior change comes with regression coverage. `yarn test:coverage` must keep 100% functions, 95% lines and statements and 90% branches; never skip a test or lower a threshold to make a run pass.
- Integration tests run only against the test instance on port 2021, never against the development server on 2020 or any other workspace.

### Logging and privacy

- No `console.log`; oxlint allows only `console.warn` and `console.error`. Log an operation name, an error code and an error name. Never log tokens, API keys, client secrets, signing links, Assinafy response bodies, error messages that may echo them, or signer contact data. The unit-test setup fails any test that logs a fixture credential.
- Real email addresses, credentials and tokens belong only in the process environment or the git-ignored `.env`. Tests, examples, fixtures, screenshots and repository metadata use `@example.invalid` addresses; `yarn check:emails` enforces it.
- Any Twenty instance is valid; never assume Twenty Cloud. Never commit workspace URLs, tokens or API keys.

### Assinafy integration

- Follow the API reference at https://api.assinafy.com.br/v1/docs (including its OAuth integration guide) and use the installed `@assinafy/sdk`; its source is https://github.com/assinafy/typescript-sdk.
- Use production Assinafy endpoints only (`ASSINAFY_API_BASE_URL`, `ASSINAFY_AUTHORIZATION_ENDPOINT` and `ASSINAFY_TOKEN_ENDPOINT` in `src/constants/assinafy.ts`). Only tests may pass another base URL to `createAssinafyClientFactory`. The live suite runs against the sandbox and stays fail-closed for any other host.
- The connection provider requests `documents:read documents:write templates:read templates:write account:read offline_access` with PKCE and form-encoded token requests, and declares no `revokeEndpoint`: the disconnect and uninstall hooks revoke grants with the client credentials. `ASSINAFY_CLIENT_ID` and `ASSINAFY_CLIENT_SECRET` stay optional so API-key workspaces keep working.
- Credentials (details in Architecture → Credential resolution): interactive calls use the member's personal connection, then shared connections, then the API key; background work (cron, workflow, health check) uses the API key and shared connections only. A send uses only the first interactive candidate. If Twenty cannot list connections, fail with `PROVIDER_UNAVAILABLE`, never fall back to the API key. A mutating handler never switches credentials after its first Assinafy call.
- Money paths: always estimate before sending, show the estimate and require the member's confirmation. Re-estimate immediately before the billable call and compare credits in cents and documents exactly (`assertEstimateUnchanged`). Workflows compare against `maxCredits` (0 means plan documents only).
- Never retry a billable call (`assignments.create`, `documents.createFromTemplate`, `assignments.resendNotification`), automatically or by falling through to another credential. Map its failures with `toAppError(error, 'billable')`: network errors, timeouts, 5xx, 408 and 409 are `UNCERTAIN`, and the record is kept for reconciliation. Claim the `SENDING` record (unique `requestId`) before the billable call, and never report a confirmed send as failed because a later Twenty write failed.
- Never delete an Assinafy document that may have been assigned: discard and purge only unsent drafts of the same Assinafy workspace that no record references.
- Routes are `POST`, require a signed-in member, parse input strictly and always answer HTTP 200 with the `{ ok, ... }` envelope from `toAppResult`; they never answer 401.
- Pass Assinafy messages through `sanitizeProviderMessage` before they reach the UI. Never store signing links or CPF/CNPJ numbers in Twenty.
- Follow the token policy (Architecture → Token policy): member-visible reads and the creation of the `SENDING` record use `userCore`; status and sync writes, signed-file uploads, the cron and workflows run as the application. Every `assinafyDocument` field except `name` stays application-writable only.
- The app uses no Assinafy webhooks and exposes no public endpoints; statuses are polled.

### Documentation

- SETUP.md, identifiers, code comments and log lines are in English. README.md, CHANGELOG.md and SECURITY.md are in Brazilian Portuguese; exact interface labels and configuration values keep their original text.
- README.md is the Twenty marketplace About page and the npm README: plain markdown only, with no images, raw HTML or badges.
- Keep README.md, SETUP.md, SECURITY.md and CHANGELOG.md accurate to the code whenever behavior changes. Release notes, changelog entries and commit messages describe the change itself.

### Before opening a pull request

```bash
yarn lint
yarn check:emails
yarn test:coverage
yarn twenty apply        # regenerates the typed client
yarn typecheck
yarn build
yarn verify              # lint, emails, coverage, typecheck and build in one run
yarn test:integration    # test instance on port 2021 only
yarn test:live           # optional, Assinafy sandbox, needs .env
```

Report a suite that could not run (no Docker, no test instance, no sandbox credentials) separately from a failing assertion.

## Local Twenty servers

```bash
yarn twenty docker:start          # development server on http://localhost:2020
yarn twenty docker:start --test   # isolated test server on http://localhost:2021
yarn twenty docker:status
yarn twenty docker:stop [--test]
```

Use 2020 for manual work and 2021 for integration tests only. `docker:start` picks the image version from `engines.twenty` unless you pass one.

Register the development server as a remote once with `yarn twenty remote:add --local`. Signing in interactively (without `--api-key`) gives the remote a user token, which `yarn twenty dev:function:exec` needs: Twenty refuses to execute logic functions for API-key remotes.

## Sync the app

```bash
yarn twenty apply
```

`apply` shows the metadata plan, applies it to the default remote and regenerates the typed API client in `node_modules/twenty-client-sdk` from the synced schema. The custom object `assinafyDocument` only exists in that generated client, so run `yarn twenty apply` before `yarn typecheck`; otherwise every query on Assinafy documents fails to typecheck. `yarn twenty plan` previews the changes without applying them.

Use `apply` for every sync. Do not leave `yarn twenty dev` (watch mode) running while you or a tool runs other syncs, and never run two of these at the same time: `apply`, `yarn test:integration`, `yarn test:e2e` and `yarn twenty dev:generate-client` rewrite the generated client, and `apply` and `yarn build` both rewrite `.twenty/output` (`yarn build` also typechecks against the generated client).

### Changing the schema

1. Add or change the field in `src/objects/assinafy-document.object.ts` (new identifiers go in `src/constants/universal-identifiers.ts`; `yarn twenty dev:add` scaffolds entities with valid UUID v4 identifiers).
2. Run `yarn twenty apply` so the server and the generated client know the field.
3. Only then read or write the field in queries, selections and mappers (`src/data/`).

If the generated client gets out of step with the source (for example after a failed sync), restore the pre-generated default client and sync again:

```bash
rm -rf node_modules/twenty-client-sdk && yarn install
yarn twenty apply
```

## Scripts

| Command | What it does |
| --- | --- |
| `yarn lint` | oxlint with `--deny-warnings` over the repository. |
| `yarn lint:fix` | oxlint with automatic fixes. |
| `yarn typecheck` | `tsc --noEmit -p tsconfig.spec.json` (sources, tests and config files). Run after `yarn twenty apply`. |
| `yarn test` | Unit tests (`src/**/__tests__/**/*.test.ts`). No server or network needed. |
| `yarn test:watch` | Unit tests in watch mode. |
| `yarn test:coverage` | Unit tests with V8 coverage. Fails below 100% functions, 95% lines and statements, 90% branches, over `src/assinafy-client`, `src/data`, `src/services`, `src/utils`, `src/logic-functions`, `src/front-components/utils` and the `build-*` helpers in `src/fields`, `src/page-layout-tabs`, `src/command-menu-items` and `src/timeline-activity-types`. |
| `yarn test:integration` | Integration tests (`src/**/*.integration-test.ts`) against a live Twenty server; see below. |
| `yarn test:live` | Opt-in suite (`src/**/*.live-test.ts`) against the Assinafy sandbox; see below. |
| `yarn test:e2e` | Opt-in end-to-end suite (`src/__tests__/e2e/**/*.e2e-test.ts`) inside the local Twenty test server, with Assinafy simulated on top of the sandbox; see below. |
| `yarn check:emails` | Fails when a tracked file contains an email address outside reserved domains such as `example.invalid`. |
| `yarn build` | `twenty dev:build`: builds the app into `.twenty/output` (emptied first) and typechecks it with `tsconfig.json`. It does not generate the API client; run `yarn twenty apply` first. |
| `yarn verify` | `lint`, `check:emails`, `test:coverage`, `typecheck` and `build`, in that order. Run after `yarn twenty apply` or `yarn test:integration`, which generate the typed client. |
| `yarn twenty <command>` | The Twenty CLI; `yarn twenty --help` lists its commands. |

### Unit tests

Tests live in `__tests__` folders next to the code they cover. The setup file `src/__tests__/setup/unit-test-setup.ts` captures console output and fails any test that logs one of the fake credentials or signing links used as fixtures. Mocks, stubbed environment variables and stubbed globals are restored after each test.

`src/front-components/__tests__/worker-safe-apis.test.ts` follows the import graph of every `*.front-component.tsx` (`src/…` and relative imports) and fails when any module it reaches, shared modules in `src/utils`, `src/data`, `src/constants` and `src/types` included, uses an API that Twenty's front-component worker lacks because it is not a secure context (`crypto.randomUUID`, `crypto.subtle`, the clipboard).

### Integration tests

```bash
yarn twenty docker:start --test
TWENTY_USER_ACCESS_TOKEN=<seeded admin access token> yarn test:integration
```

The suites live in `src/__tests__/integration/`. `vitest.config.mts` targets `TWENTY_API_URL` (default `http://localhost:2021`) with `TWENTY_API_KEY` (default: `DEV_API_KEY` from `twenty-sdk/cli`, the seeded workspace API key of the local test image). Calls made as a member need `TWENTY_USER_ACCESS_TOKEN`, a workspace member's access token. For local runs, use the seeded admin's access token of the local test container: Twenty publishes it as the `api-key` output of its `spawn-twenty-app-dev-test` action (`.github/actions/spawn-twenty-app-dev-test/action.yml` in `twentyhq/twenty`). When `TWENTY_API_KEY` is itself a member access token, as in CI, it also serves as the member token. Checks of calls made without a member (routes answer `FORBIDDEN`, the key cannot execute logic functions) use `TWENTY_WORKSPACE_API_KEY`, a workspace API key (default: `DEV_API_KEY`); they are skipped only when neither `TWENTY_WORKSPACE_API_KEY` nor `TWENTY_API_KEY` is an API key. Set `ASSINAFY_EGRESS=0` to skip the tests that make real HTTPS calls from Twenty's function runtime to Assinafy with an invalid key.

The global setup checks `/healthz`, writes the remote into `~/.twenty/config.test.json` (your own remotes are untouched), uninstalls any previous copy, syncs the app with `apply`, and uninstalls it after the run. Tests run one file at a time. The suite refuses a `NODE_ENV` other than `test` (the CLI would then use `~/.twenty/config.json`), and any `TWENTY_API_URL` other than `http://localhost:2021` unless `TWENTY_INTEGRATION_ALLOW_REMOTE=1` is set; never point it at the development server or a production workspace.

### Live tests

```bash
cp .env.example .env   # fill in the sandbox values; .env is git-ignored
yarn test:live
```

The suite lives in `src/__tests__/live/` and calls `https://sandbox.assinafy.com.br/v1` only. Variables: `ASSINAFY_SANDBOX_API_KEY`, `ASSINAFY_SANDBOX_ACCOUNT_ID`, `ASSINAFY_LIVE_SIGNER_EMAIL` (an inbox you control that may receive sandbox invitations), and optionally `ASSINAFY_LIVE_TEMPLATE_ID` (a ready template with signer and optionally editor roles; several signer roles work when the sandbox accepts `@example.invalid` signers) and `ASSINAFY_LIVE_SIGNED_DOCUMENT_ID`. A missing required variable fails the run instead of skipping it. The template listing check skips with a printed reason when the sandbox lists no template, and otherwise asserts the payload keys `summarizeTemplate` reads. Each send computes its deadline right before the call, so sandbox latency never makes it `too_soon`. `afterAll` deletes the uploads a run left behind, within a 300 s hook timeout. Keep real addresses and keys only in `.env`.

### End-to-end suite

```bash
yarn twenty docker:start --test
cp .env.example .env   # fill in the sandbox values; .env is git-ignored
TWENTY_USER_ACCESS_TOKEN=<seeded admin access token> yarn test:e2e
```

The suite exercises the app inside the real Twenty test server: it installs a build of the app, calls its routes exactly as the front components do (with the application token `frontComponent(id)` hands them), runs its logic functions, workflow action, health check and hooks, and connects OAuth accounts headlessly. Assinafy is replaced by the simulator in `src/__tests__/e2e/simulator/assinafy-simulator.mjs`: an auto-approving OAuth server plus a `/v1` proxy that swaps its own tokens (or a fake API key) for the sandbox API key and forwards to `https://sandbox.assinafy.com.br/v1`, with fault injection and a request log the tests assert on. Scenarios, run one file at a time in name order:

1. Install: object, relation fields, view, navigation item, record page tabs and widgets, command menu items, timeline activity types, logic functions, front component bundles and the connection provider; the health check warning without a credential.
2. API key: context, prepare, send (record, signers, timeline entry), idempotent retry, refresh, resend quote and confirmed resend, cancel, discard of an own upload and refusal of another member's; a template send when the sandbox lists a ready template with one signer role (`ASSINAFY_LIVE_TEMPLATE_ID` picks one), skipped with the reason otherwise.
3. Faults: a billable assignment accepted upstream but answered 500 (`UNCERTAIN`, reconciled by the sync cron), a refused API key (`RECONNECT_REQUIRED`, failing health check), a rate-limited read (`RATE_LIMITED`).
4. OAuth: personal and shared connections (authorization code, client authentication, PKCE), token refresh and rotation, a refused refresh (Twenty drops the connection without flagging it, and the call goes out as the next candidate, the shared connection), narrowed scopes (a template send without `templates:write` answers `INSUFFICIENT_SCOPE` without flagging the connection, skipped when the sandbox has no template with a signer role; a connection without `templates:read` is flagged by the template listing), revoked grants (`RECONNECT_REQUIRED` with no fallback to the shared connection, failing health check), and revocation on disconnect, flagged connections included.
5. Sync cron and pending-upload purge: statuses sync; an unsent upload older than 24 hours is deleted, one a send still references is kept.
6. Workflow action: a manual workflow sends and returns the record; a paid (WhatsApp) send with `maxCredits` 0 sends nothing and deletes its upload, or keeps it on the pending-upload list for the purge while Assinafy is still processing it (`COST_LIMIT_EXCEEDED`, or `INSUFFICIENT_RESOURCES` when the sandbox balance does not cover it). The action runs in Twenty's worker, which may see an application variable change only after its 10-second workspace cache memoization, so a run that answers `NOT_CONNECTED` (before any Assinafy call) or `ACCOUNT_REQUIRED` (the new key with the cleared account id, before any upload) is run again until the worker sees both variables.
7. AI tools: `get-signature-context-tool`, `propose-signature-request` and `get-assinafy-document-status`.
8. Uninstall: the hook revokes every grant once; the object, fields, functions, front components, key-value rows and connections are gone; the registration variables remain.
9. Reinstall: a clean, working app.

Twenty memoizes workspace data, application variables included, for up to 10 seconds in both the server and the worker, so every switch of the Assinafy credential waits until the health check (which reads the variables) reflects it before the next step.

Prerequisites: Docker with the test container `twenty-app-dev-test` serving `http://localhost:2021`, `TWENTY_USER_ACCESS_TOKEN` (see Integration tests), and in `.env` `ASSINAFY_SANDBOX_API_KEY` and `ASSINAFY_SANDBOX_ACCOUNT_ID` (optionally `ASSINAFY_LIVE_TEMPLATE_ID`). Signers use `@example.invalid` addresses. The suite needs sandbox credentials, so it is not part of `yarn verify` or CI.

What it changes on the test server, and how teardown restores it:

- The simulator is copied into the container and started there on `127.0.0.1:4010` (loopback only, not published); the sandbox key and the generated simulator secrets reach it as environment variable names only. Teardown stops it and removes its files.
- `OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS` is set to `["localhost"]` through the admin panel, so Twenty's own OAuth calls reach the simulator. Teardown deletes the database config variable.
- The app registration's `ASSINAFY_CLIENT_ID` and `ASSINAFY_CLIENT_SECRET` are set to the simulator's client. The uninstall scenario resets them, and so does teardown.
- The app is installed from a temporary copy of the repository (without `node_modules`, `.git`, `.twenty`, `coverage` and `.env`; `node_modules` is linked) whose `src/constants/assinafy.ts` points the three Assinafy endpoints at the simulator, and whose `sync-assinafy-documents` cron pattern is parked on `0 0 1 1 *`, so no scheduled tick adds requests to the simulator log windows the tests count (the suite runs the cron body on demand). The setup fails if a production literal is not found exactly once. Teardown uninstalls the app and removes the copy. The repository, `yarn build` and anything published keep the production endpoints and schedule only.
- Every sandbox document the run touched that is still open is deleted in the sandbox.
- Twenty's seeded demo workspace runs a workflow that creates a company named after each new person's email domain, so every fixture set leaves one `assinafy-<run id>.invalid` company. Teardown deletes those companies last; the integration suite's teardown does the same.

The suite refuses any server other than `http://localhost:2021`, any container whose `SERVER_URL` differs, and a `NODE_ENV` other than `test` (the CLI would then sync to the default remote of `~/.twenty/config.json`). Like `yarn test:integration`, it writes `~/.twenty/config.test.json` and regenerates the typed client, so never run it alongside another sync.

Set `E2E_KEEP_INSTALLED=1` to leave the simulation build installed, with its Assinafy API key variable set to the simulator's key, and the simulator running after the run, for a manual check in the UI: sign in at `http://localhost:2021`, and the app's Assinafy calls go through the simulator to the sandbox. OAuth Add connection does not work from a browser, because it redirects to the simulator's port, which is not published. The `OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS` config variable also stays set; the registration's OAuth client does not, because the uninstall scenario resets it and nothing sets it again. The next `yarn test:e2e` run without the variable starts from scratch and restores the server in its teardown.

## User interface language

- Assinafy's only market is Brazil, so every user-facing string is written in Brazilian Portuguese directly as the source text: front components and their messages, object, field and select option labels, the view, tab, widget, command, navigation item and timeline labels, workflow action labels, variable labels and descriptions, and health check banners. There is no translation catalog; front-component strings still go through `t`, `msg` or `Trans`, with the pt-BR text as the message.
- `locales/en.json` is intentionally `{}`, so every Twenty locale shows the pt-BR source text. Do not add catalog entries, and do not run `yarn twenty dev:translations-extract`: it would regenerate the catalogs from the source strings.
- Code identifiers, API values (select option values such as `PENDING_SIGNATURE`, object and field API names such as `assinafyDocument` and `signerCount`), error codes, `lastError` codes, code comments and log lines (`console.warn`, `console.error`) stay in English.
- Because the status option labels are pt-BR source text, native lists, filters and the app's panels show the same status names.

## Running logic functions by hand

```bash
yarn twenty dev:function:exec -n sync-assinafy-documents
yarn twenty dev:function:exec -n get-assinafy-document-status -p '{"documentRecordId":"<assinafyDocument id>"}'
yarn twenty dev:function:exec --uninstall
yarn twenty dev:function:logs -n sync-assinafy-documents
```

These need a remote added by signing in; Twenty refuses API-key remotes. Lifecycle hooks do not run during `apply`. `--uninstall` runs the uninstall hook as the signed-in member, and the uninstall and disconnect hooks ignore any run a member starts (see Credential resolution), so use a real uninstall or a Settings disconnect to exercise revocation.

## Continuous integration

`.github/workflows/ci.yml` runs on pushes to `main`, on pull requests, weekly (Monday 06:00 UTC) and when called by the publish workflow (`workflow_call`, with the boolean input `publish`). Its single `verify` job:

1. spawns a Twenty test instance with `twentyhq/twenty/.github/actions/spawn-twenty-app-dev-test` (image `v2.42.6`; the weekly run uses `latest` to catch platform changes early);
2. only when called with `publish: true`: fails unless the run is for a tag named `v<package.json version>`, before the dependencies are installed;
3. installs with `yarn install --immutable`;
4. runs `yarn lint`, `yarn check:emails` and `yarn test:coverage`;
5. runs `yarn test:integration` against the spawned instance, which also syncs the app and generates the typed client;
6. runs `yarn typecheck` and `yarn build`;
7. only when called with `publish: true`: upgrades npm (trusted publishing needs 11.5.1 or later) and runs `yarn twenty app:publish`, which builds the package and publishes it with provenance. It runs in this job because its typecheck needs the client the integration sync generated.

## Publishing

The app is published to npm as `@assinafy/twenty-app` and listed in the Twenty marketplace through the `twenty-app` keyword.

1. Bump `version` in `package.json`; each release must be strictly higher than the last.
2. Add the release to CHANGELOG.md.
3. Run `yarn test:integration` against a test instance (it syncs the app and generates the typed client), then `yarn verify`.
4. Tag the commit `vX.Y.Z` (matching `package.json`) and push the tag.
5. `.github/workflows/publish.yml` calls `ci.yml` with `publish: true`, so the full CI suite, the tag check and the npm publish (with provenance) run in one job. It can also be started by hand from the Actions tab, on the release tag; a run on a branch fails the tag check.

One-time setup: on npmjs.com, open the package → Settings → Trusted Publisher and register this repository with the `publish.yml` workflow. npm accepts provenance only from a **public** GitHub repository, and provenance is what lets the app be claimed in Twenty.

After the first publish:

- **Claim the app:** in the owner workspace, open Settings → Applications → Developer, enter `@assinafy/twenty-app` under Claim an application, select Look up, then Claim with GitHub (signed in as an owner of the GitHub organization that owns the repository).
- **Catalog sync:** Twenty imports npm packages into the marketplace catalog hourly; `yarn twenty dev:catalog-sync` (or `-r <remote>`) triggers it immediately.
- **Server variables on Twenty Cloud:** open the app under My apps, go to the Config tab and fill in `ASSINAFY_CLIENT_ID` and `ASSINAFY_CLIENT_SECRET` from an Assinafy OAuth application whose redirect URI is the Cloud server's `<SERVER_URL>/auth/apps/callback`.

### Release checklist

- [ ] Version bumped, CHANGELOG.md updated, tag matches the version.
- [ ] `yarn test:integration` and then `yarn verify` pass.
- [ ] Every file referenced by `src/application-config.ts` exists in `public/` (a unit test checks this). The manifest lists no `galleryImages`, so twenty-sdk generates the marketplace cover from `public/logo.svg`; screenshots, when added, go in `public/gallery/` and in `galleryImages`, at 8:5, with synthetic `@example.invalid` data only.
- [ ] `engines.twenty` names the `.0` release of the oldest Twenty minor the app is tested on. Twenty compares it with the workspace's upgraded version, which stays at `.0` across patch releases, so `>=2.42.6` would refuse a 2.42.6 server.
- [ ] README.md matches the shipped behavior; it is the marketplace About page, so it stays plain markdown (no images, raw HTML or badges).
- [ ] The Assinafy OAuth application is verified by Assinafy (unverified applications show a warning and are limited to 25 Assinafy workspaces), registered as Confidential with all six scopes and the exact redirect URI of every Twenty server that uses it.
- [ ] Server variables are set on the registration's Config tab for Twenty Cloud.

## Architecture

### Folders

| Path | Responsibility |
| --- | --- |
| `src/application-config.ts` | App manifest: marketplace metadata and the four variables. |
| `src/default-role.ts` | The app's least-privilege role. |
| `src/constants/` | Universal identifiers, Assinafy endpoints and scopes, limits, credential failure codes, document statuses, signer verification and notification methods, key-value store keys, the NOT_CONNECTED message shared by the server and the front end. |
| `src/objects/`, `src/fields/`, `src/indexes/` | The `assinafyDocument` object, the reverse relations on Person, Company and Opportunity, the unique `requestId` index. |
| `src/views/`, `src/navigation-menu-items/`, `src/page-layout-tabs/`, `src/command-menu-items/`, `src/timeline-activity-types/` | UI metadata. |
| `src/connection-providers/` | The Assinafy OAuth provider (PKCE, form-encoded token requests, revocation through the disconnect hook). |
| `src/front-components/` | Four entry components; `components/` are rendering shells; `utils/` hold the testable logic (send-flow reducer, request builders, error and estimate messages, status display, the panel's remove, resend confirmation and error selection). The document panel and the Signatures tab are thin wrappers that render their body keyed by the selected record id, so Twenty's record navigation inside a mounted widget starts every state over. |
| `src/logic-functions/` | Entry definitions (routes, AI tools, workflow action, cron, health check, hooks); `handlers/` implement them, except the prepare and send routes, which call their services in `src/services/` directly; `utils/` build the handler context and shared guards. |
| `src/services/` | Business operations: prepare, estimate, send, sync, signer upsert, attachment download, pending-upload bookkeeping. |
| `src/assinafy-client/` | Assinafy client factory and credential resolution. |
| `src/data/` | Twenty queries and mutations, and the record mappers. |
| `src/utils/` | Input parsers and validators, error mapping, status mapping, cost normalization. |
| `src/types/` | Shared types. |
| `locales/` | `en.json`, intentionally `{}`: UI strings are pt-BR source text (see User interface language). |
| `scripts/` | `check-no-real-emails.mjs`. |
| `public/` | Logo and marketplace images (served publicly; never put private data there). |

### Front-component bundles

`frontComponentSharedDependencies` in `package.json` lists the runtime modules the four front components share (React, `react-dom/client` and the `twenty-ui` subpaths they import). The build bundles them once into `front-component-shared-dependencies.mjs` instead of into every component. When a front component imports a new `twenty-ui` runtime subpath, add it to that list.

### Request flow

1. A front component calls `callAppRoute('/s/assinafy/<route>', body)`, a `POST` through Twenty's `RestApiClient` with the member's session.
2. The logic function parses the body with a strict parser (unknown keys, bad UUIDs and out-of-range values are `INVALID_INPUT`), builds a `HandlerContext` and requires a signed-in member (`FORBIDDEN` otherwise). Record, attachment, request and other UUIDs are lowercased when parsed. `expiresAt` rejects impossible calendar dates (for example `2027-02-30` or `2027-02-29`) with reason `format` instead of rolling them over, and repeated template editor field ids are `INVALID_INPUT` `source.editorFields.fieldId:duplicate`.
3. The handler resolves an Assinafy credential, calls Assinafy and Twenty, and throws `AppFailure(code, message, details)` for expected failures.
4. `toAppResult` always answers HTTP 200 with `{ ok: true, ... }` or `{ ok: false, error: { code, message, details } }`. Routes never answer 401, because the REST client would replay it. Unexpected errors become `INTERNAL` and are logged by error name only.
5. The front component maps `error.code` (and `details.field`/`details.reason` for `INVALID_INPUT`) to a pt-BR message with `getErrorMessage`. Anything that is not an envelope is treated as `INTERNAL`.

AI tools use the same handlers with the tool input instead of a request body. The workflow action and the cron call handlers directly.

The context (`/s/assinafy/context` and `get-signature-context-tool`) includes `recentSends`: the record's `assinafyDocument` rows (matched on `personId`, `companyId` or `opportunityId`) created within `RECENT_SEND_WINDOW_MS` (1 hour) with any status except `FAILED`, newest first, at most `MAX_RECENT_SENDS` (5), as `{ documentRecordId, name, status }`. They are read with `userCore` (`findRecentSends`, which selects only `id`, `name` and `status`), so a member who cannot read `assinafyDocument` gets the same `FORBIDDEN` (`member_create_permission`) from the context route and the AI tool as from the send; any other read failure fails the context. The review step lists their name and status, with no link that would leave the flow, and keeps Send for signature disabled until the member ticks the acknowledgement; the AI tool description tells the model to warn about them.

### Credential resolution

- **Kinds:** `personal` (a member's own connection), `shared` (a workspace-visible connection) and `apiKey` (`ASSINAFY_API_KEY`).
- **Interactive** (routes and AI tools, a member is present): the member's usable personal connections, then their own shared ones, then other shared connections, then the API key (`listInteractiveCredentials`). Connections are listed sequentially, because parallel listings race Twenty's token refresh.
- **Background** (cron, workflow, health check): the API key, then shared connections (`listBackgroundCredentials`). Personal connections are never used without their owner.
- `listAssinafyConnections` sorts every listing by name (numeric pt-BR collation, so "Assinafy #2" comes before "Assinafy #10"), then by id, because Twenty lists without an order; the order decides which credential comes first.
- **Sending** uses only the first interactive candidate (`selectSendCredential`), so a request never silently goes out from another Assinafy workspace. The workflow action (`selectWorkflowCredential`) uses the API key alone when it is set. Otherwise it resolves every shared connection, one after another, before any mutating call, sends with the first, and refuses with `ACCOUNT_REQUIRED` when they reach different Assinafy workspaces; a connection that fails to resolve fails the run. A rejected credential is never replaced by another. **Existing documents** use the first candidate whose Assinafy workspace matches the record's `assinafyAccountId` (`selectDocumentCredential`), skipping candidates that are rejected, lack a scope, are forbidden or need an account id; none matching is `FORBIDDEN`, or `RECONNECT_REQUIRED` when every candidate was rejected (401) or lacked a scope.
- **Account per credential** (`resolveCredentialAccount`): an OAuth grant must list exactly one Assinafy workspace (none: `RECONNECT_REQUIRED`, which flags the connection; several: `INTERNAL`); an API key uses `ASSINAFY_ACCOUNT_ID`, else its only workspace, else `ACCOUNT_REQUIRED`. `ACCOUNT_REQUIRED` therefore only concerns the API key (and the workflow check above).
- If Twenty cannot list connections, the call fails with `PROVIDER_UNAVAILABLE` (`details.provider: 'twenty'`, which the front end words as Twenty not answering); it never falls back to the API key, which would change the acting identity. A failed attachment download from Twenty carries the same detail.
- When the Assinafy workspace lookup (run for every credential before its other calls) or the template listing fails, a 401 (`RECONNECT_REQUIRED`) flags the OAuth connection for reconnect, and a 403 `insufficient_scope` flags it only when the missing scope is one the app requests and the connection lacks. Failures of later calls go back to the member as error codes without flagging the connection.
- Twenty's connection listing silently drops connections whose refresh failed (revoked, refresh token reused, or 30 days without a refresh: each refresh returns a refresh token valid for another 30 days). `detectExpiredConnections` runs on every listing of shared connections (interactive and background) and tracks only unflagged listed connections, as `{ missingSince }` in the key-value store. An id that stays missing for over an hour is probed with `getConnection` and flagged when that call fails, so the General tab shows it needs reconnecting. A connection Twenty lists with `authFailedAt` set is not tracked, so its reason is never overwritten. A connection flagged by the detector, already flagged, or gone (Twenty no longer finds it, on `getConnection` or when flagging) is forgotten; a reconnect lists the same id again, unflagged. Any other flagging failure leaves it unflagged for the next run. The stored value is compared with sorted keys, because Twenty stores it as jsonb, and saved only when it changed.
- Idle cron runs do not list connections (see Background sync), and Twenty runs the health check only on demand, so a shared connection used only by a rare workflow in a workspace without open documents can reach 30 days without a refresh and expire.
- The disconnect and uninstall hooks do nothing when a member starts the run (`context.userWorkspaceId` set), because Twenty's `executeOneLogicFunction` lets any role with the Workflows permission run any app function; they log `FORBIDDEN` and return. Twenty runs the real hooks without a member. Otherwise they revoke the connection's access token with the client credentials (`revokeAssinafyGrant`); Twenty gives apps no refresh token, and Assinafy ends the grant for either token. `getConnection` refuses a connection the app flagged, so the disconnect hook then reads its token from `listConnections`, which still returns flagged connections. The uninstall hook revokes every connection with the token its single unfiltered listing already resolved, so each connection is read (and refreshed) once. Revocation is best effort and never blocks the disconnect or the uninstall.

### Known platform limitations

- Twenty 2.42 refreshes OAuth tokens without a lock, and Assinafy ends a grant when a refresh token is reused. Two concurrent calls on a connection whose token is older than 55 minutes can therefore end the connection; the member then reconnects.
- Twenty 2.42.6 stores page layout widgets that reach an open browser through its live metadata updates without the configuration `__typename`, and its widget renderer shows "No Data" for a `FRONT_COMPONENT` widget whose configuration is not typed `FrontComponentConfiguration`. A browser that had Twenty open while the app was installed or reinstalled therefore shows "No Data" in the app's widgets until its site data is cleared; a fresh browser session renders them. Nothing in the app can change this.
- Right after an uninstall, record pages that were open can throw "Cannot resolve morph junction metadata" in Twenty's front end until they are reloaded.
- A workflow started by a database event, a cron or a webhook runs its code steps without a member, like the real lifecycle hooks, so a code step that targets the disconnect or uninstall hook's function passes the member-run guard: the app cannot tell it from Twenty's own run. A role with the Workflows permission can revoke Assinafy grants this way; no token, signer data or billable call is exposed, and members reconnect. The guard stays because it still stops `executeOneLogicFunction` and manually started runs.
- Removing a workspace member (or the member deleting their account) runs Twenty's `ConnectedAccountOwnershipTransferService`: every connection the member owned, workspace-visible ones included, is archived with its tokens nulled. Twenty then calls only its own revoke, which does nothing because the provider declares no `revokeEndpoint`, and never runs the disconnect hook. The grant stays active in Assinafy until it lapses after 30 days without a refresh, and the connection disappears from the listings without being flagged (the detector forgets it as gone). The app cannot hook member removal; README.md tells admins to remove the member's connections first.

### Token policy

`HandlerContext` carries two Twenty clients:

- `userCore` (default token: the member's permissions intersected with the app role) for everything the member must be allowed to see or do: reading the CRM record, its attachments and people, reading an Assinafy document before acting on it, and creating the `SENDING` record at send time.
- `appCore` / `appMetadata` (`runAs: 'application'`) for status and sync writes, signed-file uploads, the cron and workflows.

Every field of `assinafyDocument` except `name` is application-writable only, so members cannot forge statuses or links.

### Status lifecycle

```text
send ──► SENDING ──► PENDING_SIGNATURE ──► CERTIFICATING ──► CERTIFICATED
            │               │    ▲               (signed files pending)
            │               │    └── EXPIRED (deadline extended in Assinafy)
            │               ├──► REJECTED_BY_SIGNER
            │               ├──► CANCELLED (cancelled from Twenty, Assinafy rejected_by_user, or 404)
            │               ├──► FAILED (Assinafy failed)
            │               └──► UNKNOWN (unrecognized Assinafy status)
            ├──► FAILED     (a failure that proves nothing was sent, or NOT_SENT once confirmed unsent)
            └──► UNCERTAIN  (timeout, 5xx, 408, 409 or an unexpected answer on a billable call, or an abandoned
                             template send past its lease)
```

- Assinafy statuses map through `mapAssinafyStatus`; draft statuses (`uploading`, `uploaded`, `metadata_processing`, `metadata_ready`) on a sent record read as `PENDING_SIGNATURE`.
- Assinafy `failed` maps to `FAILED` from any non-final status, including an `UNCERTAIN` or `SENDING` record whose document already left draft; such a record was sent.
- A sync never moves a record out of `CERTIFICATED`, `REJECTED_BY_SIGNER`, `CANCELLED` or `FAILED`. `EXPIRED` can return to `PENDING_SIGNATURE`. A final record also keeps its `lastError`: a failed refresh of it (network, 401, 429, 404 and so on) is only reported to the caller, never stored. Refreshing a `FAILED` record returns it unchanged without a credential or an Assinafy call, so the reason the send failed stays.
- `CERTIFICATED` is set only once every expected signed file (`certificated`, plus `pades` when Assinafy lists it) is stored in `signedDocument`; until then the record stays `CERTIFICATING` with `lastError = SIGNED_FILES_PENDING`.
- `UNCERTAIN` with an Assinafy document id resolves on the next sync: an assignment or a non-draft status means it was sent (`PENDING_SIGNATURE`); a draft without assignment, once the send lease has passed, means it was not (`FAILED`, `NOT_SENT`). A `SENDING` record past its lease without a document id (an abandoned template send) becomes `UNCERTAIN` with `lastError = UNCERTAIN` without any Assinafy call or credential, in the cron and on refresh (Atualizar or opening the panel) alike. A template send without a document id then stays `UNCERTAIN` until a member removes it. A template send whose 2xx answer carries no valid document id is recorded `UNCERTAIN` too, never `PENDING_SIGNATURE`.

### Idempotency and uncertain outcomes

- The send flow mints `requestId` (a UUID) when the member selects Send for signature. After an `INTERNAL` answer (no envelope, so the outcome is unknown) it keeps the key and stays on the review step. While the key is kept, the reducer ignores draft edits and step changes, so only Revisar estimativa novamente and a retry with the same `requestId` remain. An `UNCERTAIN` answer, or a send answered with an `UNCERTAIN` or `SENDING` record, ends the flow on an error screen with no send or re-estimate action (only Abrir documento, from the returned record or from `details.documentRecordId`), so the member checks Assinafy before sending again. A definite failure, or a retry answered with a `FAILED` record, discards the key. A closed flow or a reloaded page starts with a new key, which is why the review step warns about `recentSends`.
- The send route checks only the format of `expiresAt` while parsing. `sendSignatureRequest` returns the existing record when the `requestId` is known, even when the deadline is now close or past. Otherwise it re-checks everything that cannot charge (deadline at least 65 minutes ahead, `SEND_MIN_EXPIRATION_MINUTES`; for a member send, an upload the calling member prepared in that Assinafy workspace, younger than `PENDING_UPLOAD_SEND_CUTOFF_MS`; the upload still an unsent draft of the same Assinafy workspace; the fresh estimate equal to the confirmed one in cents and documents), then claims a `SENDING` record through the unique `requestId` index before the billable call. A concurrent duplicate hits the unique index and returns the winner's record. A role that cannot create (or look up) `assinafyDocument` gets `FORBIDDEN` with `details.reason: 'member_create_permission'` before anything is sent.
- Prepare reuse and member sends accept only an upload the calling member prepared in that Assinafy workspace (its pending-upload entry, as the discard route requires), and only while that entry is younger than `PENDING_UPLOAD_SEND_CUTOFF_MS` (the 24 h TTL minus 1 hour). Otherwise they answer `INVALID_STATE`, and the next review uploads the PDF again; this also covers an entry lost to the unlocked read-modify-write. Workflow sends skip the check: they send the upload they made in the same run. The purge's reference check only sees claims already made, and it looks at an entry only at 24 h, so every accepted send has claimed its record long before. The discard route relies on the front end never discarding an upload a send was attempted with.
- A send failure after the claim returns `details.documentRecordId` (the claimed record), so the front end can open it.
- Billable calls (`assignments.create`, `documents.createFromTemplate`, `assignments.resendNotification`) are made exactly once and never retried. Network errors, timeouts, 5xx, 408, 409 and unexpected errors on them become `UNCERTAIN`; any other failure of a send becomes `FAILED` with its code in `lastError`. A resend writes nothing to the record, so after an uncertain resend the status stays unchanged. The panel also treats an `INTERNAL` answer to a confirmed resend (a lost or unreadable response) as `UNCERTAIN`, so the member checks Assinafy instead of paying twice.
- After a confirmed send, the record update is attempted twice. If both fail, the member still gets a success; the record stays `SENDING` until its lease (120 s send timeout + 60 s) ends, and the next sync then resolves it like an `UNCERTAIN` record.
- Twenty never passes a retry count to workflow steps: its step retries ("Tentar novamente em caso de falha") always run with `retryCount` 0 and a fresh `requestId`. The workflow action is protected by (1) `deadlineMs` (start + `SEND_TIMEOUT_SECONDS` × 1000 − 10 s): the send refuses to start the billable call when now + `BILLABLE_CALL_BUDGET_MS` (35 s: the 30 s client timeout plus about 5 s to record) would pass it, with `PROVIDER_UNAVAILABLE`, the claim recorded `FAILED` and nothing charged; (2) `findPreviousAttempt`: a non-`FAILED` `assinafyDocument` for the same record id and name created within `SEND_LEASE_MS` makes the run return `UNCERTAIN` with that record before any upload, estimate or billable call; only the read-only workspace lookup of the workflow credential and, for a template, the template listing that supplies the name run before the check (a failed read fails closed with `INTERNAL`); (3) `retryCount > 0` returning `UNCERTAIN`, kept as a fallback. Builders must still leave the step retry off. Residual risk: a response that trickles in can outlive the client's socket-idle timeout.
- The workflow action compares its send estimate with `maxCredits` in cents (`assertWithinCreditLimit`, the limit rounded down to whole cents) before sending, and never resends. When a run fails before the claim, or its claim ends `FAILED`, it deletes its upload with `deleteUnsentUpload`; it leaves the upload to the purge when fewer than `BILLABLE_CALL_BUDGET_MS` remain before the deadline, when the claim is `UNCERTAIN`, or when the claim cannot be read.
- Resends quote first (`estimateResendCost`) and resend only at the cost the member confirmed (`expectedTotalCredits`, re-checked with `assertEstimateUnchanged`). Only the member-facing route resends.
- `deleteUnsentUpload` (the discard route and the workflow's cleanup) deletes only an unsent draft of the same Assinafy workspace, or an unassigned upload whose Assinafy processing failed (`isDeletableUpload`); such an upload is never reused or sent. Right before the delete it checks with `appCore` that no record other than a `FAILED` send references the upload (`findUploadReference`); otherwise it fails with `INVALID_STATE` and the pending entry stays. A send claims its `SENDING` record before assigning the upload, so a claim made before that check blocks the delete. The discard route also refuses (`INVALID_STATE`) an upload that is not in the pending-upload store with the caller's `userWorkspaceId` and the same Assinafy workspace; workflow uploads are stored without a member. A 404 (already gone) counts as success and forgets the entry. A 400 (Assinafy still processing the upload) also counts as success, so the discard route answers `{ ok: true }` and the workflow cleanup logs nothing, but nothing is deleted and the entry stays for the pending-upload purge (see Background sync).

### Background sync

`sync-assinafy-documents` runs every 15 minutes with a 240 s timeout and stops starting new records at 80% of it. It selects up to 50 records, oldest `lastSyncedAt` first: statuses `PENDING_SIGNATURE`, `CERTIFICATING` and `UNKNOWN`, `UNCERTAIN` with a document id, and `SENDING` past its lease. Confirmed sends are windowed by `sentAt` (the last 120 days); unconfirmed ones (`UNCERTAIN` and `SENDING`, which have no `sentAt`) by `createdAt`. It lists background credentials only when there is work (records or expired uploads), so idle runs do not refresh tokens. Each record syncs with the credential that reaches its `assinafyAccountId`; a record without an Assinafy document (an abandoned template send) settles without one; any other record without a matching credential gets `lastError = NO_CREDENTIAL` and moves to the back of the queue.

The run ends with the pending-upload purge. The pending-upload list (`KV_PENDING_UPLOADS`) keeps the newest `MAX_PENDING_UPLOADS` (200) entries; an eviction logs `console.warn` with code `PENDING_UPLOADS_EVICTED`, and an evicted upload is never purged or discardable. Twenty's key-value store has no compare-and-swap, so the list is written without a lock and a concurrent write can drop an entry. The purge deletes uploads older than 24 hours (`PENDING_UPLOAD_TTL_MS`) that Assinafy still reports as unsent drafts, or as unassigned uploads whose processing failed, of the same Assinafy workspace, and that no record other than a `FAILED` send references, so the uploads of sends that ended `FAILED` are included. A 404 forgets the entry. Any expired entry that is not deleted (no background credential reaches its workspace, for example one uploaded through a personal connection; a send still references it; or its check or delete keeps failing, a 400 while Assinafy still processes the upload included) is kept for later runs and forgotten without being deleted at 7 days (`PENDING_UPLOAD_MAX_AGE_MS`), so it does not keep every run listing credentials. The purge re-reads the list before writing it and removes only the entries it dropped, so uploads recorded while it runs are kept.

## Assinafy API usage

Production endpoints only: `https://api.assinafy.com.br/v1` and `https://auth.assinafy.com.br/oauth/authorize`. Clients are created per credential and invocation with a 30 s timeout and 2 retries (5 s and no retries for the health check); the SDK never retries non-idempotent calls. A request interceptor adds `expand=assignment` to `GET /documents/{id}`.

| Operation | SDK method | Endpoint | Scope |
| --- | --- | --- | --- |
| Resolve the Assinafy workspace | `workspaces.list()` | `GET /accounts` | none |
| List templates (4 pages of 50) | `templates.list()` | `GET /accounts/{accountId}/templates` | `templates:read` |
| Upload the PDF | `documents.upload()` | `POST /accounts/{accountId}/documents` | `documents:write` |
| Read a document with its assignment | `documents.details()` | `GET /documents/{documentId}?expand=assignment` | `documents:read` |
| Estimate a PDF request | `assignments.estimateCost()` | `POST /documents/{documentId}/assignments/estimate-cost` | `documents:write`* |
| Estimate a template request | `documents.estimateCostFromTemplate()` | `POST /accounts/{accountId}/templates/{templateId}/documents/estimate-cost` | `templates:read`* |
| Create or reuse a signer | `signers.create()` | `GET /accounts/{accountId}/signers?search=` then `POST /accounts/{accountId}/signers` | `documents:read`, `documents:write` |
| Update a signer | `signers.update()` | `PUT /accounts/{accountId}/signers/{signerId}` | `documents:write` |
| Send a PDF (billable) | `assignments.create()` | `POST /documents/{documentId}/assignments` | `documents:write` |
| Send a template (billable) | `documents.createFromTemplate()` | `POST /accounts/{accountId}/templates/{templateId}/documents` | `documents:write`, `templates:write` |
| Estimate a resend | `assignments.estimateResendCost()` | `POST /documents/{documentId}/assignments/{assignmentId}/signers/{signerId}/estimate-resend-cost` | `documents:write`* |
| Resend an invitation (billable) | `assignments.resendNotification()` | `PUT /documents/{documentId}/assignments/{assignmentId}/signers/{signerId}/resend` | `documents:write` |
| Download signed PDFs | `documents.download(id, 'certificated' \| 'pades')` | `GET /documents/{documentId}/download/{artifact}` | `documents:read` |
| Cancel a request, discard or purge an upload | `documents.delete()` | `DELETE /documents/{documentId}` | `documents:write` |
| Revoke a grant | `oauth.revokeToken()` | `POST /oauth/revoke` | none (client credentials) |

Assinafy's API reference states that `GET /accounts` needs no scope and names none for the other endpoints; their scopes follow the scope descriptions of Assinafy's OAuth integration guide. \* marks the estimate endpoints, which those descriptions do not mention. The app requests all six scopes, so each call is covered.

Reference: https://api.assinafy.com.br/v1/docs, including its OAuth integration guide.
