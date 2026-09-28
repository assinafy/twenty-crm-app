// Twenty 2.42's object permission denial as the core client throws it; `data` holds the roots the member may read.
export const permissionDenied = (data?: object | null) =>
  Object.assign(new Error('Permission denied'), {
    errors: [{ message: 'Permission denied', extensions: { code: 'FORBIDDEN', subCode: 'PERMISSION_DENIED' } }],
    data,
  });
