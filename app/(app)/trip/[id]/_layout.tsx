import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Tabs, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { subscribeExpenses, subscribePayments } from '@/src/services/expenses';
import { subscribeMembers, subscribeTrip } from '@/src/services/trips';
import { canMutateTrip, normalizeTripPhase } from '@/src/lib/tripPhase';
import type { Expense, Payment, Trip, TripMember } from '@/src/types';
import { colors } from '@/src/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { TripProvider } from '@/src/hooks/useTrip';

export default function TripLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);
  const { user } = useAuth();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubs = [
      subscribeTrip(tripId, (t) => {
        setTrip(t);
        setReady(true);
      }),
      subscribeMembers(tripId, setMembers),
      subscribeExpenses(tripId, setExpenses),
      subscribePayments(tripId, setPayments),
    ];
    return () => unsubs.forEach((u) => u());
  }, [tripId]);

  const value = useMemo(() => {
    const isAdmin = !!user && trip?.adminUid === user.uid;
    const isFinanceLead = !!user && trip?.financeLeadUid === user.uid;
    const phase = normalizeTripPhase(trip?.phase);
    return {
      tripId,
      trip,
      members,
      expenses,
      payments,
      isAdmin,
      isFinanceLead,
      phase,
      isClosed: phase === 'closed',
      canMutate: canMutateTrip(trip, { isAdmin, isFinanceLead }),
    };
  }, [tripId, trip, members, expenses, payments, user]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <TripProvider value={value}>
      <Tabs
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerShadowVisible: false,
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.inkMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 60,
            paddingTop: 4,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: trip?.name || 'Resumo',
            tabBarLabel: 'Resumo',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="finance"
          options={{
            title: 'Finanças',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="wallet-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="itinerary"
          options={{
            title: 'Roteiro',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="map-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Feed',
            headerShown: false,
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="images-outline" color={color} size={size} />
            ),
          }}
        />
        <Tabs.Screen
          name="members"
          options={{
            title: 'Membros',
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people-outline" color={color} size={size} />
            ),
          }}
        />
      </Tabs>
    </TripProvider>
  );
}
