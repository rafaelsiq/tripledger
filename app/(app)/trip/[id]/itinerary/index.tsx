import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { EmptyState } from '@/src/components/ui';
import { subscribeItineraryDays } from '@/src/services/itinerary';
import type { ItineraryDay } from '@/src/types';
import { spacing } from '@/src/theme';
import { useTrip } from '@/src/hooks/useTrip';

export default function ItineraryHome() {
  const { trip } = useTrip();
  const router = useRouter();
  const [days, setDays] = useState<ItineraryDay[]>([]);

  useEffect(() => {
    if (!trip) return;
    return subscribeItineraryDays(trip.id, setDays);
  }, [trip]);

  if (!trip) return null;

  return (
    <View style={styles.screen}>
      <Text style={styles.hero}>Roteiro</Text>
      <Text style={styles.sub}>Cada dia, uma história visual da viagem.</Text>
      <FlatList
        data={days}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ gap: spacing.md, paddingBottom: 40 }}
        ListEmptyComponent={
          <EmptyState title="Sem dias" subtitle="Defina as datas da viagem para gerar a agenda." />
        }
        renderItem={({ item, index }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: `/(app)/trip/${trip.id}/itinerary/day/[dayId]`,
                params: { dayId: item.id },
              })
            }
            style={styles.dayCard}
          >
            <Text style={styles.dayIndex}>Dia {index + 1}</Text>
            <Text style={styles.dayTitle}>{item.title || 'Programação'}</Text>
            <Text style={styles.dayDate}>
              {format(parseISO(item.date), "EEEE, d 'de' MMMM", { locale: ptBR })}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0C0A09',
    padding: spacing.md,
  },
  hero: {
    color: '#FFF7ED',
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: -0.8,
  },
  sub: {
    color: 'rgba(255,247,237,0.65)',
    marginBottom: spacing.lg,
    marginTop: 6,
  },
  dayCard: {
    backgroundColor: '#1C1917',
    borderRadius: 20,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dayIndex: {
    color: '#F97316',
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    fontSize: 12,
  },
  dayTitle: {
    color: '#FFF7ED',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 8,
  },
  dayDate: {
    color: 'rgba(255,247,237,0.55)',
    marginTop: 6,
    textTransform: 'capitalize',
  },
});
