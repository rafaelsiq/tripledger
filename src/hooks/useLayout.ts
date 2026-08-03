import { useSyncExternalStore } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { layout } from '@/src/theme';

function subscribeMq(onChange: () => void) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => undefined;
  }
  const mq = window.matchMedia(`(min-width: ${layout.breakpointMd}px)`);
  // Safari < 14
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else mq.addListener(onChange);
  return () => {
    if (mq.removeEventListener) mq.removeEventListener('change', onChange);
    else mq.removeListener(onChange);
  };
}

function getMqWide() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }
  return window.matchMedia(`(min-width: ${layout.breakpointMd}px)`).matches;
}

export function useLayout() {
  const { width: dimWidth, height } = useWindowDimensions();

  // Web: desktop-first (SSR + matchMedia). Native: window dimensions.
  const mqWide = useSyncExternalStore(
    subscribeMq,
    getMqWide,
    () => Platform.OS === 'web'
  );

  const width =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.innerWidth || dimWidth
      : dimWidth;

  const isWide = Platform.OS === 'web' ? mqWide : width >= layout.breakpointMd;
  const isLarge = width >= layout.breakpointLg;

  return {
    width,
    height,
    isWide,
    isLarge,
    contentMaxWidth: layout.contentMaxWidth,
    formMaxWidth: layout.formMaxWidth,
    toastMaxWidth: layout.toastMaxWidth,
    pagePadding: isWide ? layout.pagePaddingWide : layout.pagePadding,
  };
}
