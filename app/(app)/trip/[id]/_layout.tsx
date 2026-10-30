import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, View, type ColorValue } from 'react-native';
import { Tabs, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  subscribeExpenses,
  subscribePayments,
  subscribeSettlements,
} from '@/src/services/expenses';
import { subscribeFundMovements, subscribeFunds } from '@/src/services/funds';
import { subscribeMembers, subscribeTrip } from '@/src/services/trips';
import { canMutateTrip, normalizeTripPhase } from '@/src/lib/tripPhase';
import type { Expense, Fund, FundMovement, Payment, Settlement, Trip, TripMember } from '@/src/types';
import { colors, fonts, navHeader } from '@/src/theme';
import { useAuth } from '@/src/hooks/useAuth';
import { useLayout } from '@/src/hooks/useLayout';
import { TripProvider } from '@/src/hooks/useTrip';
import { TripHomeBackButton } from '@/src/components/TripHomeBackButton';
import { TripSwitcher } from '@/src/components/TripSwitcher';
import { TripTabBar } from '@/src/components/TripTabBar';

type TabIconBase = 'home' | 'wallet' | 'map' | 'images' | 'people';

/** Desktop sidebar icon (filled glyph when focused). Mobile uses TripTabBar instead. */
function tabIcon(base: TabIconBase) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Ionicons name={focused ? base : `${base}-outline`} color={color} size={20} />;
  };
}

export default function TripLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const tripId = String(id);
  const { user } = useAuth();
  const { isWide } = useLayout();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [members, setMembers] = useState<TripMember[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [funds, setFunds] = useState<Fund[]>([]);
  const [fundMovements, setFundMovements] = useState<FundMovement[]>([]);
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
      subscribeSettlements(tripId, setSettlements),
      subscribeFunds(tripId, setFunds),
      subscribeFundMovements(tripId, setFundMovements),
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
      settlements,
      funds,
      fundMovements,
      isAdmin,
      isFinanceLead,
      phase,
      isClosed: phase === 'closed',
      canMutate: canMutateTrip(trip, { isAdmin, isFinanceLead }),
    };
  }, [tripId, trip, members, expenses, payments, settlements, funds, fundMovements, user]);

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
        // Desktop: the default bar laid out as a sidebar; mobile: our bottom bar.
        tabBar={isWide ? undefined : (props) => <TripTabBar {...props} />}
        screenOptions={{
          headerStyle: navHeader.headerStyle,
          headerShadowVisible: navHeader.headerShadowVisible,
          headerLeft: () => <TripHomeBackButton />,
          headerTitle: () => <TripSwitcher />,
          headerTitleAlign: 'left',
          tabBarPosition: isWide ? 'left' : 'bottom',
          tabBarVariant: 'material',
          tabBarLabelPosition: 'beside-icon',
          tabBarActiveTintColor: colors.accentDark,
          tabBarInactiveTintColor: colors.inkSoft,
          tabBarActiveBackgroundColor: colors.accentSoft,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderRightColor: colors.border,
            borderRightWidth: 1,
            minWidth: 220,
            paddingTop: 12,
            paddingHorizontal: 8,
          },
          tabBarItemStyle: {
            borderRadius: 8,
            marginVertical: 2,
            minHeight: 40,
            justifyContent: 'flex-start',
          },
          tabBarLabelStyle: {
            fontSize: 14,
            fontFamily: fonts.uiBold,
            lineHeight: 18,
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
