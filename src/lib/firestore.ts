import {
  setDoc,
  updateDoc,
  type DocumentData,
  type DocumentReference,
  type SetOptions,
  type WriteBatch,
} from 'firebase/firestore';

/**
 * Firestore rejects `undefined` field values (including nested ones).
 * Strip them recursively before setDoc/updateDoc/batch.set.
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

/** setDoc that never sends `undefined` fields to Firestore. */
export function safeSetDoc(
  reference: DocumentReference,
  data: DocumentData,
  options?: SetOptions
) {
  const cleaned = omitUndefinedDeep(data);
  return options ? setDoc(reference, cleaned, options) : setDoc(reference, cleaned);
}

/** updateDoc that never sends `undefined` fields to Firestore. */
export function safeUpdateDoc(reference: DocumentReference, data: DocumentData) {
  return updateDoc(reference, omitUndefinedDeep(data));
}

/** batch.set that never sends `undefined` fields to Firestore. */
export function safeBatchSet(
  batch: WriteBatch,
  reference: DocumentReference,
  data: DocumentData,
  options?: SetOptions
) {
  const cleaned = omitUndefinedDeep(data);
  return options ? batch.set(reference, cleaned, options) : batch.set(reference, cleaned);
}

/** batch.update that never sends `undefined` fields to Firestore. */
export function safeBatchUpdate(
  batch: WriteBatch,
  reference: DocumentReference,
  data: DocumentData
) {
  return batch.update(reference, omitUndefinedDeep(data));
}
