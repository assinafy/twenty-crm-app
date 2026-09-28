import { graphql } from 'src/__tests__/e2e/graphql';
import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Its own module so the global setup can use it without loading the member-token checks of the test helpers.
export const uninstallApp = () =>
  graphql('metadata', 'mutation ($id: String!) { uninstallApplication(universalIdentifier: $id) }', {
    id: APPLICATION_UNIVERSAL_IDENTIFIER,
  });
