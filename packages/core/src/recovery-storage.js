export const recoveryPrefix = 'sitebuilder:recovery:v1:';
/** Remove only builder recovery documents when a host explicitly ends its session. */
export function clearRecoveryCopies(storage) {
  try {
    const keys = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(recoveryPrefix)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
