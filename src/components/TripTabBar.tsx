import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, fonts, radii } from '@/src/theme';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

type TabIconBase = 'home' | 'wallet' | 'map' | 'images' | 'people';

/** Route name → Ionicons base glyph (filled when active, `-outline` otherwise). */
const ICONS: Record<string, TabIconBase> = {
  index: 'home',
  finance: 'wallet',
  itinerary: 'map',
  feed: 'images',
  members: 'people',
};

/**
 * Mobile bottom bar for a trip: icon on a soft pill + label, always both visible.
 * Replaces the default bar, whose fixed height clipped the labels under the pill.
 */
export function TripTabBar({ state, descriptors, navigation, insets }: TabBarProps) {
  const bottom = Math.max(insets.bottom, Platform.OS === 'web' ? 8 : 6);

  return (
    <View style={[styles.bar, { paddingBottom: bottom }]} accessibilityRole="tablist">
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key]!;
        const focused = state.index === index;
        const label = typeof options.tabBarLabel === 'string' ? options.tabBarLabel : options.title ?? route.name;
        const icon = ICONS[route.name] ?? 'ellipse';

        function onPress() {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        }

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={label}
            style={({ pressed }) => [styles.item, pressed && { opacity: 0.75 }]}
          >
            <View style={[styles.pill, focused && styles.pillActive]}>
              <Ionicons
                name={focused ? icon : (`${icon}-outline` as const)}
                size={22}
                color={focused ? colors.accent : colors.inkSoft}
              />
            </View>
            <Text style={[styles.label, focused && styles.labelActive]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    minHeight: 48,
  },
  pill: {
    width: 56,
    height: 30,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.accentSoft },
  label: {
    fontFamily: fonts.uiSemi,
    fontSize: 11,
    lineHeight: 14,
    color: colors.inkSoft,
  },
  labelActive: { fontFamily: fonts.uiBold, color: colors.accentDark },
});
