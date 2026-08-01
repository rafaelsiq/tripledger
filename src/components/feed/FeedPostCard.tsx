import React, { useEffect, useState } from 'react';
import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FeedComment, FeedPost } from '@/src/types';
import { addComment, subscribeComments, toggleLike } from '@/src/services/feed';
import { colors, radii, spacing } from '@/src/theme';

type Props = {
  tripId: string;
  post: FeedPost;
  currentUid: string;
  currentName: string;
};

export function FeedPostCard({ tripId, post, currentUid, currentName }: Props) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [text, setText] = useState('');
  const liked = post.likes.includes(currentUid);

  useEffect(() => {
    return subscribeComments(tripId, post.id, setComments);
  }, [tripId, post.id]);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.author}>{post.authorName}</Text>
        <Text style={styles.date}>
          {format(post.createdAt, "dd MMM · HH:mm", { locale: ptBR })}
        </Text>
      </View>
      <Image source={{ uri: post.mediaUrl }} style={styles.media} />
      {post.caption ? <Text style={styles.caption}>{post.caption}</Text> : null}
      <View style={styles.actions}>
        <Pressable onPress={() => toggleLike(tripId, post, currentUid)}>
          <Text style={[styles.action, liked && styles.liked]}>
            {liked ? '♥' : '♡'} {post.likes.length}
          </Text>
        </Pressable>
        <Text style={styles.action}>💬 {comments.length}</Text>
      </View>
      <View style={styles.comments}>
        {comments.slice(-3).map((c) => (
          <Text key={c.id} style={styles.comment}>
            <Text style={styles.commentAuthor}>{c.authorName} </Text>
            {c.text}
          </Text>
        ))}
      </View>
      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Comentar..."
          placeholderTextColor="rgba(255,255,255,0.4)"
          style={styles.input}
        />
        <Pressable
          onPress={async () => {
            if (!text.trim()) return;
            await addComment({
              tripId,
              postId: post.id,
              authorUid: currentUid,
              authorName: currentName,
              text,
            });
            setText('');
          }}
        >
          <Text style={styles.send}>Enviar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.feed,
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  author: { color: colors.white, fontWeight: '700', fontSize: 14 },
  date: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
  media: { width: '100%', height: 280, backgroundColor: '#1c1917' },
  caption: {
    color: 'rgba(255,255,255,0.9)',
    padding: spacing.md,
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  action: { color: colors.white, fontWeight: '600' },
  liked: { color: '#F97316' },
  comments: { paddingHorizontal: spacing.md, gap: 4 },
  comment: { color: 'rgba(255,255,255,0.8)', fontSize: 13 },
  commentAuthor: { fontWeight: '700', color: colors.white },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    color: colors.white,
    fontSize: 14,
  },
  send: { color: '#F97316', fontWeight: '700' },
});
