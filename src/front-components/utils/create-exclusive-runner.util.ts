// Runs one task at a time and ignores calls made while a task runs. A click can reach a render that predates the
// disabled button, so create one runner per mounted component (useState) to share the lock. `onError` receives a
// task's unexpected throw, which would otherwise vanish in the front-component worker and leave a button that does
// nothing.
export const createExclusiveRunner = (
  onError: (error: unknown) => void,
): ((task: () => Promise<void>) => Promise<void>) => {
  let busy = false;

  return async (task) => {
    if (busy) {
      return;
    }

    busy = true;

    try {
      await task();
    } catch (error) {
      onError(error);
    } finally {
      busy = false;
    }
  };
};
