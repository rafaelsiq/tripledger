import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
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
      <Text style={styles.hero}>Roteiro</Text>
      <Text style={styles.sub}>Cada dia, uma história visual da viagem.</Text>
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
  hero: {
    color: colors.ink,
    fontSize: 34,
    fontFamily: fonts.displayBold,
    letterSpacing: -0.8,
  },
  sub: {
    color: colors.inkSoft,
    fontFamily: fonts.ui,
    marginBottom: spacing.lg,
    marginTop: 6,
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
