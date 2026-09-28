// The front-component sandbox serializes change events: the value may be on detail, on the event, or on the target.
export const readEventValue = (event: unknown): string => {
  const { detail, value, target } = (event ?? {}) as {
    detail?: { value?: unknown };
    value?: unknown;
    target?: { value?: unknown };
  };

  for (const candidate of [detail?.value, value, target?.value]) {
    if (typeof candidate === 'string') {
      return candidate;
    }
  }

  return '';
};
