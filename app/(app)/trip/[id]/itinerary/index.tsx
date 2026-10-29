import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import {
  EmptyState,
  ListGroup,
  ListRow,
  PageHeader,
  Screen,
} from '@/src/components/ui';
import { ItineraryViewSwitcher } from '@/src/components/itinerary/ItineraryViewSwitcher';
import { todayValue } from '@/src/lib/dates';
import { subscribeItineraryDays } from '@/src/services/itinerary';
import type { ItineraryDay } from '@/src/types';
import { colors, fonts, radii, spacing } from '@/src/theme';
import { useTrip } from '@/src/hooks/useTrip';

/** Weekday + day-of-month tile used as each day's leading element. */
function DateTile({ date, today }: { date: string; today: boolean }) {
  const parsed = parseISO(date);
  return (
    <View style={[styles.dateTile, today && styles.dateTileToday]}>
      <Text style={[styles.dateWeekday, today && styles.dateTextToday]}>
        {format(parsed, 'EEE', { locale: ptBR }).replace('.', '').toUpperCase()}
      </Text>
      <Text style={[styles.dateDay, today && styles.dateTextToday]}>{format(parsed, 'd')}</Text>
    </View>
  );
}

export default function ItineraryHome() {
  const { trip, isAdmin, isFinanceLead } = useTrip();
  const router = useRouter();
  const [days, setDays] = useState<ItineraryDay[]>([]);

  useEffect(() => {
    if (!trip) return;
    return subscribeItineraryDays(trip.id, setDays);
  }, [trip]);

  if (!trip) return null;

  const today = todayValue();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <PageHeader
          title="Roteiro"
          subtitle={
            days.length > 0
              ? `${days.length} ${days.length === 1 ? 'dia' : 'dias'} de programação`
              : undefined
          }
        />
        <ItineraryViewSwitcher tripId={trip.id} current="list" />
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />

        {days.length === 0 ? (
          <EmptyState title="Sem dias" subtitle="Defina as datas da viagem para gerar a agenda." />
        ) : (
          <ListGroup>
            {days.map((item, index) => {
              const isToday = item.date === today;
              return (
                <ListRow
                  key={item.id}
                  leading={<DateTile date={item.date} today={isToday} />}
                  title={`Dia ${index + 1} · ${item.title || 'Programação'}`}
                  subtitle={`${format(parseISO(item.date), "EEEE, d 'de' MMMM", { locale: ptBR })}${
                    isToday ? ' · hoje' : ''
                  }`}
                  chevron
                  onPress={() =>
                    router.push({
                      pathname: `/(app)/trip/${trip.id}/itinerary/day/[dayId]` as never,
                      params: { dayId: item.id },
                    })
                  }
                />
              );
            })}
          </ListGroup>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  dateTile: {
    width: 46,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  dateTileToday: { backgroundColor: colors.ink, borderColor: colors.ink },
  dateWeekday: { fontFamily: fonts.uiBold, fontSize: 11, color: colors.inkSoft },
  dateDay: {
    fontFamily: fonts.uiHeavy,
    fontSize: 17,
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  dateTextToday: { color: colors.white },
});
