export const notWritableErrorPattern = (field?: string) =>
  new RegExp(
    field
      ? String.raw`(?=.*(?:not writable|no permission to write))(?=.*field "${field}" on "assinafyDocument")`
      : String.raw`not writable|no permission to write`,
    'i',
  );
