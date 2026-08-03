import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Button, EmptyState, Screen } from '@/src/components/ui';
import { FeedPostCard } from '@/src/components/feed/FeedPostCard';
import { useAuth } from '@/src/hooks/useAuth';
import { useLayout } from '@/src/hooks/useLayout';
import { useTrip } from '@/src/hooks/useTrip';
import { subscribeFeed } from '@/src/services/feed';
import type { FeedPost } from '@/src/types';
import { colors, fonts, spacing } from '@/src/theme';

export default function FeedHome() {
  const { trip, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { user, profile } = useAuth();
  const { isWide } = useLayout();
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useEffect(() => {
    if (!trip) return;
    return subscribeFeed(trip.id, setPosts);
  }, [trip]);

  if (!trip || !user || !profile) return null;

  return (
    <Screen>
      <View style={[styles.top, isWide && styles.topWide]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.hero}>Memórias</Text>
          <Text style={styles.sub}>O feed do grupo — fotos, vídeos e momentos.</Text>
        </View>
        {canMutate ? (
          <View style={isWide ? styles.publishWide : undefined}>
            <Button
              title="Publicar"
              onPress={() => router.push(`/(app)/trip/${trip.id}/feed/new`)}
            />
          </View>
        ) : null}
      </View>
      <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
      <FlatList
        style={styles.list}
        data={posts}
        key={isWide ? 'feed-grid' : 'feed-list'}
        keyExtractor={(item) => item.id}
        numColumns={isWide ? 2 : 1}
        columnWrapperStyle={isWide ? styles.gridRow : undefined}
        ListEmptyComponent={
          <EmptyState
            title="Feed vazio"
            subtitle="Publique a primeira memória da viagem."
          />
        }
        renderItem={({ item }) => (
          <View style={isWide ? styles.gridItem : undefined}>
            <FeedPostCard
              tripId={trip.id}
              post={item}
              currentUid={user.uid}
              currentName={profile.displayName}
            />
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { marginBottom: spacing.sm },
  topWide: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  publishWide: { minWidth: 180 },
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
  list: {
    flex: 1,
    marginTop: spacing.md,
  },
  gridRow: { gap: spacing.md },
  gridItem: { flex: 1 },
});
