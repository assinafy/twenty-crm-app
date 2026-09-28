// A raw GraphQL POST to a Twenty endpoint; throws on GraphQL errors or a missing data payload.
export const postGraphql = async <TData>(
  url: string,
  token: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<TData> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const { data, errors } = (await response.json()) as { data?: TData; errors?: Array<{ message: string }> };
  if (errors?.length || !data) {
    throw new Error(`GraphQL ${new URL(url).pathname} failed: ${errors?.map(({ message }) => message).join('; ') ?? response.status}`);
  }
  return data;
};
