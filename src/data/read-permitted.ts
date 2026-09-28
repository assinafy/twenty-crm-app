import { isPermissionDenied } from 'src/data/is-permission-denied';

// Runs a member-scoped read and keeps what Twenty returned when the only errors are object permission denials: root
// connections are nullable, so a denied object comes back as null next to the objects the member may read.
export const readPermitted = async <T>(read: () => Promise<T>): Promise<T> => {
  try {
    return await read();
  } catch (error) {
    const data = isPermissionDenied(error) ? (error as { data?: unknown }).data : undefined;
    if (typeof data === 'object' && data !== null) {
      return data as T;
    }
    throw error;
  }
};
