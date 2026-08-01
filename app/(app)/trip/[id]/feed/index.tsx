import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, EmptyState } from '@/src/components/ui';
import { FeedPostCard } from '@/src/components/feed/FeedPostCard';
import { useAuth } from '@/src/hooks/useAuth';
import { subscribeFeed } from '@/src/services/feed';
import type { FeedPost } from '@/src/types';
import { spacing } from '@/src/theme';
import { useTrip } from '@/src/hooks/useTrip';

export default function FeedHome() {
  const { trip } = useTrip();
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
      <Button
        title="Publicar"
        onPress={() => router.push(`/(app)/trip/${trip.id}/feed/new`)}
      />
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
    marginBottom: spacing.md,
    marginTop: 6,
  },
});
