/**
 * Firestore rejects `undefined` field values (including nested ones).
 * Strip them recursively before setDoc/updateDoc.
 */
export function omitUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => omitUndefinedDeep(item)) as T;
  }
  if (value !== null && typeof value === 'object') {
    // Keep Firestore FieldValue / Date / Blob-like instances as-is.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .map(([key, entry]) => [key, omitUndefinedDeep(entry)])
    ) as T;
  }
  return value;
}
