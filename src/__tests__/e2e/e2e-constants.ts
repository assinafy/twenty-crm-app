// The only Twenty server the end-to-end suite may change: the isolated test instance and its container.
export const E2E_TWENTY_URL = 'http://localhost:2021';
export const E2E_CONTAINER = 'twenty-app-dev-test';

// The simulator runs inside the test container, so Twenty and the logic functions reach it on loopback. Its port is not
// published: the host talks to it through `docker exec`.
export const SIM_PORT = 4010;
export const SIM_URL = `http://localhost:${SIM_PORT}`;
export const SIM_PATH_IN_CONTAINER = '/tmp/assinafy-simulator.mjs';
export const SIM_LOG_IN_CONTAINER = '/tmp/assinafy-simulator.log';

// The production literals of src/constants/assinafy.ts and what the simulation copy points them at.
export const ENDPOINT_REWRITES = [
  { from: "'https://auth.assinafy.com.br/oauth/authorize'", to: `'${SIM_URL}/oauth/authorize'` },
  { from: "'https://api.assinafy.com.br/v1/oauth/token'", to: `'${SIM_URL}/v1/oauth/token'` },
  { from: "'https://api.assinafy.com.br/v1'", to: `'${SIM_URL}/v1'` },
];

// The scheduled sync the simulation copy parks on a date no run reaches: the suite runs the cron body on demand, and a
// tick inside a test would add requests to the simulator log windows the tests count.
export const SIMULATION_CRON_PATTERN = '0 0 1 1 *';
export const CRON_REWRITE = { from: "pattern: '*/15 * * * *'", to: `pattern: '${SIMULATION_CRON_PATTERN}'` };

export const OUTBOUND_HOSTS_CONFIG_KEY = 'OUTBOUND_HTTP_ALLOWED_INTERNAL_HOSTS';
