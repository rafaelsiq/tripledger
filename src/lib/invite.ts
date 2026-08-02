import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

const PENDING_INVITE_KEY = 'tripledger:pendingInviteCode';
export const WEB_HOSTING_ORIGIN = 'https://tripledger-app.web.app';

export function normalizeInviteCode(code?: string | null): string {
  return String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/** Public web URL that anyone can open to join with a code. */
export function buildInviteWebUrl(code: string): string {
  const normalized = normalizeInviteCode(code);
  return `${WEB_HOSTING_ORIGIN}/trip/join?code=${encodeURIComponent(normalized)}`;
}

/** App / local URL (useful in Expo Go and installed apps). */
export function buildInviteAppUrl(code: string): string {
  const normalized = normalizeInviteCode(code);
  return Linking.createURL('/trip/join', {
    queryParams: { code: normalized },
  });
}

/** Prefer the shareable web link; fall back to app URL in local/dev web. */
export function buildInviteShareUrl(code: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const host = window.location.origin;
    if (host.includes('localhost') || host.includes('127.0.0.1')) {
      return `${host}/trip/join?code=${encodeURIComponent(normalizeInviteCode(code))}`;
    }
  }
  return buildInviteWebUrl(code);
}

export function buildInviteShareMessage(tripName: string, code: string): string {
  const normalized = normalizeInviteCode(code);
  const url = buildInviteShareUrl(normalized);
  return [
    `Convite para a viagem "${tripName}" no TripLedger`,
    '',
    `Código: ${normalized}`,
    `Link: ${url}`,
  ].join('\n');
}

export async function stashPendingInviteCode(code: string): Promise<void> {
  const normalized = normalizeInviteCode(code);
  if (!normalized) return;
  await AsyncStorage.setItem(PENDING_INVITE_KEY, normalized);
}

export async function peekPendingInviteCode(): Promise<string | null> {
  const value = await AsyncStorage.getItem(PENDING_INVITE_KEY);
  const normalized = normalizeInviteCode(value);
  return normalized || null;
}

export async function consumePendingInviteCode(): Promise<string | null> {
  const value = await peekPendingInviteCode();
  if (value) {
    await AsyncStorage.removeItem(PENDING_INVITE_KEY);
  }
  return value;
}
