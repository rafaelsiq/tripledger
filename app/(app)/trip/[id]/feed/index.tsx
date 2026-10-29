import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TripClosedBanner } from '@/src/components/TripPhaseBanner';
import { Button, EmptyState, PageHeader, Screen } from '@/src/components/ui';
import { FeedPostCard } from '@/src/components/feed/FeedPostCard';
import { useAuth } from '@/src/hooks/useAuth';
import { useLayout } from '@/src/hooks/useLayout';
import { useTrip } from '@/src/hooks/useTrip';
import { subscribeFeed } from '@/src/services/feed';
import type { FeedPost } from '@/src/types';
import { spacing } from '@/src/theme';

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
      <View style={styles.top}>
        <PageHeader
          title="Feed"
          subtitle={
            posts.length > 0
              ? `${posts.length} ${posts.length === 1 ? 'publicação' : 'publicações'} do grupo`
              : 'Fotos, vídeos e momentos do grupo'
          }
          actions={
            canMutate ? (
              <Button
                title="Publicar"
                icon="add"
                size="sm"
                onPress={() => router.push(`/(app)/trip/${trip.id}/feed/new`)}
              />
            ) : undefined
          }
        />
        <TripClosedBanner trip={trip} isAdmin={isAdmin} isFinanceLead={isFinanceLead} />
      </View>
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
  top: { gap: spacing.md, paddingTop: spacing.xs },
  list: {
    flex: 1,
    marginTop: spacing.md,
  },
  gridRow: { gap: spacing.md },
  gridItem: { flex: 1 },
});
