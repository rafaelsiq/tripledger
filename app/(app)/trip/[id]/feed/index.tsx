import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Button, EmptyState } from '@/src/components/ui';
import { FeedPostCard } from '@/src/components/feed/FeedPostCard';
import { useAuth } from '@/src/hooks/useAuth';
import { useTrip } from '@/src/hooks/useTrip';
import { subscribeFeed } from '@/src/services/feed';
import type { FeedPost } from '@/src/types';
import { colors, fonts, spacing } from '@/src/theme';

export default function FeedHome() {
  const { trip, canMutate, isAdmin, isFinanceLead } = useTrip();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);

  useEffect(() => {
    if (!trip) return;
    return subscribeFeed(trip.id, setPosts);
  }, [trip]);

  if (!trip || !user || !profile) return null;

  return (
    <View style={styles.screen}>
      <Text style={styles.hero}>Memórias</Text>
      <Text style={styles.sub}>O feed do grupo — fotos, vídeos e momentos.</Text>
      <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
      {canMutate ? (
        <Button
          title="Publicar"
          onPress={() => router.push(`/(app)/trip/${trip.id}/feed/new`)}
        />
      ) : null}
      <FlatList
        style={{ marginTop: spacing.md }}
        data={posts}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <EmptyState
            title="Feed vazio"
            subtitle="Publique a primeira memória da viagem."
          />
        }
        renderItem={({ item }) => (
          <FeedPostCard
            tripId={trip.id}
            post={item}
            currentUid={user.uid}
            currentName={profile.displayName}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.md,
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
    marginBottom: spacing.md,
    marginTop: 6,
  },
});
