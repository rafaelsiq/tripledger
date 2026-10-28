import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, View, type ColorValue } from 'react-native';
import { Tabs, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeExpenses, subscribePayments } from '@/src/services/expenses';
import { subscribeMembers, subscribeTrip } from '@/src/services/trips';
import { canMutateTrip, normalizeTripPhase } from '@/src/lib/tripPhase';
import type { Expense, Payment, Trip, TripMember } from '@/src/types';
import { colors, fonts, navHeader } from '@/src/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { useLayout } from '@/src/hooks/useLayout';
import { TripProvider } from '@/src/hooks/useTrip';
import { TripHomeBackButton } from '@/src/components/TripHomeBackButton';
import { TripSwitcher } from '@/src/components/TripSwitcher';

type TabIconBase = 'home' | 'wallet' | 'map' | 'images' | 'people';

/** Tab icon with a soft pill behind the active one (filled glyph when focused). */
function tabIcon(base: TabIconBase) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return (
      <View
        style={{
          paddingHorizontal: 16,
          paddingVertical: 3,
          borderRadius: 999,
          backgroundColor: focused ? colors.accentSoft : 'transparent',
        }}
      >
        <Ionicons name={focused ? base : `${base}-outline`} color={color} size={20} />
      </View>
    );
  };
}

export default function TripLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);
  const { user } = useAuth();
  const { isWide } = useLayout();
  const insets = useSafeAreaInsets();
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

  const bottomInset = isWide
    ? 10
    : Math.max(insets.bottom, Platform.OS === 'web' ? 10 : 0);

  return (
    <TripProvider value={value}>
      <Tabs
        screenOptions={{
          headerStyle: navHeader.headerStyle,
          headerShadowVisible: navHeader.headerShadowVisible,
          headerLeft: () => <TripHomeBackButton />,
          headerTitle: () => <TripSwitcher />,
          headerTitleAlign: 'left',
          tabBarPosition: isWide ? 'top' : 'bottom',
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.inkSoft,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderBottomColor: colors.border,
            borderTopWidth: isWide ? 0 : 1,
            borderBottomWidth: isWide ? 1 : 0,
            paddingTop: isWide ? 10 : 8,
            paddingBottom: bottomInset,
          },
          tabBarItemStyle: {
            paddingTop: 2,
            paddingBottom: 2,
          },
          tabBarLabelStyle: {
            fontSize: isWide ? 13 : 11,
            fontFamily: fonts.uiBold,
            lineHeight: isWide ? 16 : 14,
          },
          tabBarIconStyle: {
            marginBottom: 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Resumo',
            tabBarLabel: 'Resumo',
            tabBarIcon: tabIcon('home'),
          }}
        />
        <Tabs.Screen
          name="finance"
          options={{
            title: 'Finanças',
            headerShown: false,
            tabBarIcon: tabIcon('wallet'),
          }}
        />
        <Tabs.Screen
          name="itinerary"
          options={{
            title: 'Roteiro',
            headerShown: false,
            tabBarIcon: tabIcon('map'),
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Feed',
            headerShown: false,
            tabBarIcon: tabIcon('images'),
          }}
        />
        <Tabs.Screen
          name="members"
          options={{
            title: 'Membros',
            tabBarIcon: tabIcon('people'),
          }}
        />
      </Tabs>
    </TripProvider>
  );
}
