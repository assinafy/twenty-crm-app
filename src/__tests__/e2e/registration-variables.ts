import { graphql } from 'src/__tests__/e2e/graphql';
import { APPLICATION_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

type RegistrationVariable = { id: string; key: string; isFilled: boolean };

// The server variables (the OAuth client) live on the app registration, which survives uninstall.
export const listRegistrationVariables = async (): Promise<RegistrationVariable[]> => {
  const { findApplicationRegistrationByUniversalIdentifier: registration } = await graphql<{
    findApplicationRegistrationByUniversalIdentifier: { id: string } | null;
  }>(
    'metadata',
    'query ($id: String!) { findApplicationRegistrationByUniversalIdentifier(universalIdentifier: $id) { id } }',
    { id: APPLICATION_UNIVERSAL_IDENTIFIER },
  );
  if (!registration) return [];
  const { findApplicationRegistrationVariables } = await graphql<{
    findApplicationRegistrationVariables: RegistrationVariable[];
  }>(
    'metadata',
    'query ($id: String!) { findApplicationRegistrationVariables(applicationRegistrationId: $id) { id key isFilled } }',
    { id: registration.id },
  );
  return findApplicationRegistrationVariables;
};

// Sets a server variable, or clears it with `null`.
export const setRegistrationVariable = async (key: string, value: string | null): Promise<void> => {
  const variable = (await listRegistrationVariables()).find((candidate) => candidate.key === key);
  if (!variable) throw new Error(`The app registration has no ${key} variable.`);
  await graphql(
    'metadata',
    'mutation ($input: UpdateApplicationRegistrationVariableInput!) { updateApplicationRegistrationVariable(input: $input) { id } }',
    { input: { id: variable.id, update: value === null ? { resetValue: true } : { value } } },
  );
};
