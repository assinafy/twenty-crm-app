// One route at a time: parallel connection listings race Twenty's token refresh, and both routes rewrite the
// pending-upload list without a lock. callAppRoute never throws, so a failed discard still lets the prepare run; the
// background purge covers what the discard misses.
export const prepareAfterDiscard = async <TResult>(
  discard: (() => Promise<unknown>) | null,
  prepare: () => Promise<TResult>,
): Promise<TResult> => {
  if (discard) {
    await discard();
  }

  return prepare();
};
