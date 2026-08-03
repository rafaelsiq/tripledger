import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Badge } from '@/src/components/ui';
import {
  tripIdFromPath,
  tripSectionFromPath,
  useUserTrips,
} from '@/src/hooks/useUserTrips';
import { normalizeTripPhase, phaseLabel } from '@/src/lib/tripPhase';
import type { Trip } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

function tripHref(tripId: string, pathname: string) {
  const section = tripSectionFromPath(pathname);
  if (section) return `/(app)/trip/${tripId}/${section}` as const;
  return `/(app)/trip/${tripId}` as const;
}

export function TripSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { trips, lastTripId, rememberTripId } = useUserTrips();
  const [open, setOpen] = useState(false);

  const routeTripId = tripIdFromPath(pathname);
  const currentId = routeTripId || lastTripId;
  const current = useMemo(
    () => trips.find((t) => t.id === currentId) ?? null,
    [trips, currentId]
  );

  useEffect(() => {
    if (routeTripId) rememberTripId(routeTripId);
  }, [routeTripId, rememberTripId]);

  function onSelect(trip: Trip) {
    setOpen(false);
    rememberTripId(trip.id);
    if (trip.id === routeTripId) return;
    router.replace(tripHref(trip.id, pathname));
  }

  const label = current?.name?.trim() || 'Selecionar viagem';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Viagem atual: ${label}. Toque para trocar.`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.75 }]}
        hitSlop={8}
      >
        <View style={styles.triggerTextWrap}>
          <Text style={styles.triggerHint}>Viagem</Text>
          <Text style={styles.triggerLabel} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <Ionicons name="chevron-down" size={18} color={colors.inkSoft} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View style={styles.backdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Trocar viagem</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={colors.inkMuted} />
              </Pressable>
            </View>

            {trips.length === 0 ? (
              <Text style={styles.empty}>Você ainda não tem viagens.</Text>
            ) : (
              <FlatList
                data={trips}
                keyExtractor={(item) => item.id}
                style={styles.list}
                contentContainerStyle={{ paddingBottom: spacing.sm }}
                renderItem={({ item }) => {
                  const phase = normalizeTripPhase(item.phase);
                  const selected = item.id === currentId;
                  return (
                    <Pressable
                      onPress={() => onSelect(item)}
                      style={({ pressed }) => [
                        styles.row,
                        selected && styles.rowSelected,
                        pressed && { opacity: 0.88 },
                      ]}
                    >
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text style={styles.rowName} numberOfLines={1}>
                          {item.name}
                        </Text>
                        {item.destination ? (
                          <Text style={styles.rowMeta} numberOfLines={1}>
                            {item.destination}
                          </Text>
                        ) : null}
                      </View>
                      <Badge
                        text={phaseLabel(phase)}
                        tone={
                          phase === 'closed'
                            ? 'neutral'
                            : phase === 'in_progress'
                              ? 'success'
                              : 'accent'
                        }
                      />
                      {selected ? (
                        <Ionicons
                          name="checkmark-circle"
                          size={20}
                          color={colors.accent}
                          style={{ marginLeft: 6 }}
                        />
                      ) : null}
                    </Pressable>
                  );
                }}
              />
            )}

            <Pressable
              onPress={() => {
                setOpen(false);
                router.replace('/(app)');
              }}
              style={({ pressed }) => [styles.homeLink, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="grid-outline" size={18} color={colors.accentDark} />
              <Text style={styles.homeLinkText}>Ver todas as viagens</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    maxWidth: 260,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  triggerTextWrap: {
    flexShrink: 1,
    alignItems: 'flex-start',
  },
  triggerHint: {
    fontSize: 10,
    lineHeight: 12,
    color: colors.inkMuted,
    fontFamily: fonts.uiSemi,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  triggerLabel: {
    fontSize: 16,
    lineHeight: 20,
    color: colors.ink,
    fontFamily: fonts.uiSemi,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-start',
    paddingTop: 72,
    paddingHorizontal: spacing.md,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    maxHeight: '70%',
    overflow: 'hidden',
    zIndex: 1,
    ...shadows.card,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sheetTitle: {
    fontFamily: fonts.uiBold,
    fontSize: 16,
    color: colors.ink,
  },
  empty: {
    padding: spacing.lg,
    color: colors.inkSoft,
    fontFamily: fonts.ui,
    textAlign: 'center',
  },
  list: {
    maxHeight: 360,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowSelected: {
    backgroundColor: colors.accentSoft,
  },
  rowName: {
    fontFamily: fonts.uiBold,
    fontSize: 15,
    color: colors.ink,
  },
  rowMeta: {
    fontFamily: fonts.ui,
    fontSize: 13,
    color: colors.inkSoft,
  },
  homeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  homeLinkText: {
    fontFamily: fonts.uiSemi,
    fontSize: 14,
    color: colors.accentDark,
  },
});
