import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { EmptyState, Screen } from '@/src/components/ui';
import { useLayout } from '@/src/hooks/useLayout';
import { subscribeItineraryDays } from '@/src/services/itinerary';
import type { ItineraryDay } from '@/src/types';
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';
import { useTrip } from '@/src/hooks/useTrip';

export default function ItineraryHome() {
  const { trip, isAdmin, isFinanceLead } = useTrip();
  const { isWide, isLarge } = useLayout();
  const router = useRouter();
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const columns = isLarge ? 3 : isWide ? 2 : 1;

  useEffect(() => {
    if (!trip) return;
    return subscribeItineraryDays(trip.id, setDays);
  }, [trip]);

  if (!trip) return null;

  return (
    <Screen>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/(app)/trip/${trip.id}/itinerary/calendar`)}
              hitSlop={10}
              accessibilityLabel="Ver calendário do roteiro"
              style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.7 }]}
            >
              <Ionicons name="calendar-outline" size={18} color={colors.accent} />
              <Text style={styles.headerActionText}>Calendário</Text>
            </Pressable>
          ),
        }}
      />

      <View style={styles.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hero}>Roteiro</Text>
          <Text style={styles.sub}>Cada dia, uma história visual da viagem.</Text>
        </View>
        <Pressable
          onPress={() => router.push(`/(app)/trip/${trip.id}/itinerary/calendar`)}
          style={({ pressed }) => [styles.calendarBtn, pressed && { opacity: 0.88 }]}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.white} />
          <Text style={styles.calendarBtnText}>Calendário</Text>
        </Pressable>
      </View>

      <View style={{ marginBottom: spacing.md }}>
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
      </View>
      <FlatList
        style={styles.list}
        data={days}
        key={`days-${columns}`}
        keyExtractor={(item) => item.id}
        numColumns={columns}
        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: 40 }}
        ListEmptyComponent={
          <EmptyState title="Sem dias" subtitle="Defina as datas da viagem para gerar a agenda." />
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: `/(app)/trip/${trip.id}/itinerary/day/[dayId]` as never,
                params: { dayId: item.id },
              })
            }
            style={({ pressed }) => [
              styles.dayCard,
              columns > 1 && styles.dayCardGrid,
              pressed && { opacity: 0.92 },
            ]}
          >
            <Text style={styles.dayIndex}>Dia {index + 1}</Text>
            <Text style={styles.dayTitle}>{item.title || 'Programação'}</Text>
            <Text style={styles.dayDate}>
              {format(parseISO(item.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </Text>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  hero: {
    color: colors.ink,
    fontSize: 34,
    fontFamily: fonts.displayBold,
    letterSpacing: -0.8,
  },
  sub: {
    color: colors.inkSoft,
    fontFamily: fonts.ui,
    marginTop: 6,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  headerActionText: {
    color: colors.accent,
    fontFamily: fonts.uiSemi,
    fontSize: 14,
  },
  calendarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 6,
  },
  calendarBtnText: {
    color: colors.white,
    fontFamily: fonts.uiBold,
    fontSize: 13,
  },
  list: { flex: 1 },
  gridRow: { gap: spacing.md },
  dayCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  dayCardGrid: {
    flex: 1,
  },
  dayIndex: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  dayTitle: {
    color: colors.ink,
    fontSize: 22,
    fontFamily: fonts.display,
    marginTop: 8,
  },
  dayDate: {
    color: colors.inkMuted,
    fontFamily: fonts.ui,
    marginTop: 6,
    textTransform: 'capitalize',
  },
});
