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
import { colors, fonts, radii, shadows, spacing } from '@/src/theme';

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
          placeholderTextColor={colors.inkMuted}
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
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadows.card,
  },
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  author: {
    color: colors.ink,
    fontFamily: fonts.uiBold,
    fontSize: 14,
  },
  date: {
    color: colors.inkMuted,
    fontFamily: fonts.ui,
    fontSize: 12,
  },
  media: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: colors.surfaceMuted,
  },
  caption: {
    color: colors.ink,
    padding: spacing.md,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.ui,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  action: {
    color: colors.inkSoft,
    fontFamily: fonts.uiSemi,
  },
  liked: { color: colors.accent },
  comments: { paddingHorizontal: spacing.md, gap: 4 },
  comment: {
    color: colors.inkSoft,
    fontSize: 13,
    fontFamily: fonts.ui,
  },
  commentAuthor: {
    fontFamily: fonts.uiBold,
    color: colors.ink,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  input: {
    flex: 1,
    color: colors.ink,
    fontSize: 14,
    fontFamily: fonts.ui,
  },
  send: {
    color: colors.accent,
    fontFamily: fonts.uiBold,
  },
});
