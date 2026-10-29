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
import { Ionicons } from '@expo/vector-icons';
import { Avatar } from '@/src/components/ui';
import { colors, fonts, radii, spacing } from '@/src/theme';

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
        <Avatar name={post.authorName} size={34} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author}>{post.authorName}</Text>
          <Text style={styles.date}>
            {format(post.createdAt, "dd MMM · HH:mm", { locale: ptBR })}
          </Text>
        </View>
      </View>
      <Image source={{ uri: post.mediaUrl }} style={styles.media} />
      <View style={styles.actions}>
        <Pressable
          onPress={() => toggleLike(tripId, post, currentUid)}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Descurtir' : 'Curtir'}
          accessibilityState={{ selected: liked }}
          hitSlop={8}
          style={styles.actionBtn}
        >
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={20}
            color={liked ? colors.danger : colors.inkLabel}
          />
          <Text style={[styles.action, liked && styles.liked]}>{post.likes.length}</Text>
        </Pressable>
        <View style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={19} color={colors.inkLabel} />
          <Text style={styles.action}>{comments.length}</Text>
        </View>
      </View>
      {post.caption ? (
        <Text style={styles.caption}>
          <Text style={styles.commentAuthor}>{post.authorName} </Text>
          {post.caption}
        </Text>
      ) : null}
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
    borderRadius: radii.lg,
    overflow: 'hidden',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    paddingHorizontal: 14,
    paddingBottom: spacing.sm,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: fonts.ui,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32 },
  action: {
    color: colors.inkLabel,
    fontFamily: fonts.uiBold,
    fontSize: 14,
  },
  liked: { color: colors.danger },
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
