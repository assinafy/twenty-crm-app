import { postGraphql } from 'src/__tests__/integration/post-graphql';

// Twenty's seeded workspace runs a workflow that creates a company named after each new person's email domain. It runs
// asynchronously, so it can land after a suite's own cleanup; the suites sweep those companies once at the end. The
// fixtures' domains are unique per run (assinafy-<run id>.invalid), so nothing else matches.
const FIXTURE_COMPANY_NAME = 'assinafy-%.invalid';

export const destroyFixtureCompanies = async (apiUrl: string, token: string): Promise<number> => {
  const { companies } = await postGraphql<{ companies: { edges: Array<{ node: { id: string } }> } }>(
    `${apiUrl}/graphql`,
    token,
    'query ($name: String!) { companies(filter: { name: { like: $name } }, first: 100) { edges { node { id } } } }',
    { name: FIXTURE_COMPANY_NAME },
  );

  for (const { node } of companies.edges) {
    await postGraphql(`${apiUrl}/graphql`, token, 'mutation ($id: UUID!) { destroyCompany(id: $id) { id } }', { id: node.id });
  }

  return companies.edges.length;
};
