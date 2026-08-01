import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import type { AppUser } from '@/src/types';

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
) {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: displayName.trim() });
  const profile: AppUser = {
    uid: cred.user.uid,
    email: cred.user.email || email,
    displayName: displayName.trim(),
    createdAt: Date.now(),
  };
  await setDoc(doc(db, 'users', cred.user.uid), profile);
  return cred.user;
}

export async function loginWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const ref = doc(db, 'users', cred.user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      uid: cred.user.uid,
      email: cred.user.email || email,
      displayName: cred.user.displayName ?? (email.split('@')[0] ?? 'Viajante'),
      createdAt: Date.now(),
    } satisfies AppUser);
  }
  return cred.user;
}

export async function logout() {
  await signOut(auth);
}

export function subscribeAuth(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid: string) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? (snap.data() as AppUser) : null;
}
