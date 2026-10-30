import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, shadows } from '@/src/theme';

const STEP = 220;

/**
 * Horizontal row that scrolls with touch, trackpad, mouse wheel and mouse drag, with
 * arrow buttons at the edges when there is more to see. Plain horizontal ScrollViews
 * only scroll by touch/trackpad on web, so a mouse user could not reach the last items.
 */
export function HorizontalScroller({
  children,
  style,
  contentContainerStyle,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<ScrollView>(null);
  const [offset, setOffset] = useState(0);
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);

  const canLeft = offset > 4;
  const canRight = offset + viewport < content - 4;

  const scrollBy = useCallback(
    (delta: number) => {
      ref.current?.scrollTo({ x: Math.max(0, offset + delta), animated: true });
    },
    [offset]
  );

  // Web only: vertical wheel scrolls the row sideways, and the mouse can drag it.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = (ref.current as unknown as { getScrollableNode?: () => HTMLElement })?.getScrollableNode?.();
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      if (node.scrollWidth <= node.clientWidth) return;
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      node.scrollLeft += event.deltaY;
      event.preventDefault();
    };

    let dragging = false;
    let moved = false;
    let startX = 0;
    let startLeft = 0;
    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return;
      dragging = true;
      moved = false;
      startX = event.clientX;
      startLeft = node.scrollLeft;
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      node.scrollLeft = startLeft - dx;
    };
    const onUp = () => {
      dragging = false;
    };
    // A drag must not also count as a tap on the chip under the mouse.
    const onClick = (event: MouseEvent) => {
      if (!moved) return;
      event.stopPropagation();
      event.preventDefault();
      moved = false;
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    node.addEventListener('click', onClick, true);
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      node.removeEventListener('click', onClick, true);
    };
  }, []);

  return (
    <View style={[styles.wrap, style]}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={contentContainerStyle}
        scrollEventThrottle={32}
        onScroll={(event: NativeSyntheticEvent<NativeScrollEvent>) =>
          setOffset(event.nativeEvent.contentOffset.x)
        }
        onLayout={(event: LayoutChangeEvent) => setViewport(event.nativeEvent.layout.width)}
        onContentSizeChange={(width) => setContent(width)}
      >
        {children}
      </ScrollView>
      {canLeft ? (
        <Pressable
          onPress={() => scrollBy(-STEP)}
          accessibilityRole="button"
          accessibilityLabel="Ver anteriores"
          style={[styles.arrow, styles.arrowLeft]}
        >
          <Ionicons name="chevron-back" size={18} color={colors.ink} />
        </Pressable>
      ) : null}
      {canRight ? (
        <Pressable
          onPress={() => scrollBy(STEP)}
          accessibilityRole="button"
          accessibilityLabel="Ver mais"
          style={[styles.arrow, styles.arrowRight]}
        >
          <Ionicons name="chevron-forward" size={18} color={colors.ink} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'relative', justifyContent: 'center' },
  arrow: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.raised,
  },
  arrowLeft: { left: 0 },
  arrowRight: { right: 0 },
});
