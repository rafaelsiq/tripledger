import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { auth, db } from '@/src/lib/firebase';
import { safeSetDoc, safeUpdateDoc } from '@/src/lib/firestore';
import type { AppUser } from '@/src/types';

const GENERIC_NAMES = new Set(['viajante', 'sem nome', 'user', 'usuário', 'usuario']);

/** Prefer a real name; never keep the old "Viajante" placeholder. */
export function resolveDisplayName(input: {
  displayName?: string | null;
  email?: string | null;
}): string {
  const name = input.displayName?.trim();
  if (name && !GENERIC_NAMES.has(name.toLowerCase())) return name;
  const fromEmail = input.email?.split('@')[0]?.trim();
  if (fromEmail) return fromEmail;
  return 'Sem nome';
}

export function isGenericDisplayName(name?: string | null): boolean {
  const trimmed = name?.trim();
  return !trimmed || GENERIC_NAMES.has(trimmed.toLowerCase());
}

async function waitForUserProfile(uid: string, attempts = 8): Promise<AppUser | null> {
  for (let i = 0; i < attempts; i++) {
    const profile = await getUserProfile(uid);
    if (profile && !isGenericDisplayName(profile.displayName)) return profile;
    if (profile && i === attempts - 1) return profile;
    await new Promise((r) => setTimeout(r, 150));
  }
  return getUserProfile(uid);
}

export async function registerWithEmail(
  email: string,
  password: string,
  displayName: string
) {
  const name = displayName.trim();
  if (!name) throw new Error('Informe seu nome');
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  await updateProfile(cred.user, { displayName: name });
  const profile: AppUser = {
    uid: cred.user.uid,
    email: cred.user.email || email,
    displayName: name,
    photoURL: cred.user.photoURL || undefined,
    createdAt: Date.now(),
  };
  await safeSetDoc(doc(db, 'users', cred.user.uid), profile);
  return cred.user;
}

export async function loginWithEmail(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const ref = doc(db, 'users', cred.user.uid);
  const snap = await getDoc(ref);
  const displayName = resolveDisplayName({
    displayName: snap.exists()
      ? (snap.data() as AppUser).displayName
      : cred.user.displayName,
    email: cred.user.email || email,
  });
  if (!snap.exists()) {
    await safeSetDoc(ref, {
      uid: cred.user.uid,
      email: cred.user.email || email,
      displayName,
      photoURL: cred.user.photoURL || undefined,
      createdAt: Date.now(),
    } satisfies AppUser);
  } else if (isGenericDisplayName((snap.data() as AppUser).displayName)) {
    await safeUpdateDoc(ref, { displayName });
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

/** Authoritative profile for trip actions (avoids stale "Viajante" from auth race). */
export async function getResolvedUserProfile(user: {
  uid: string;
  email?: string | null;
  displayName?: string | null;
}): Promise<{ uid: string; email: string; displayName: string }> {
  const stored = await waitForUserProfile(user.uid);
  const email = stored?.email || user.email || '';
  const displayName = resolveDisplayName({
    displayName: stored?.displayName ?? user.displayName,
    email,
  });

  if (stored && stored.displayName !== displayName) {
    await safeUpdateDoc(doc(db, 'users', user.uid), { displayName });
  }

  return { uid: user.uid, email, displayName };
}

/** Push the user's displayName onto every trip membership (fixes old "Viajante" rows). */
export async function syncMembershipDisplayNames(
  uid: string,
  displayName: string
): Promise<void> {
  const name = displayName.trim();
  if (!name || isGenericDisplayName(name)) return;
  const memberships = await getDocs(collection(db, 'users', uid, 'memberships'));
  await Promise.all(
    memberships.docs.map(async (membership) => {
      const tripId = membership.id;
      const memberRef = doc(db, 'trips', tripId, 'members', uid);
      const snap = await getDoc(memberRef);
      if (!snap.exists()) return;
      const current = snap.data().displayName as string | undefined;
      if (current === name) return;
      await safeUpdateDoc(memberRef, { displayName: name });
    })
  );
}
