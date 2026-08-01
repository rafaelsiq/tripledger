import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, Input, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { useTrip } from '@/src/hooks/useTrip';
import { createFeedPost } from '@/src/services/feed';
import { spacing } from '@/src/theme';

export default function NewFeedPost() {
  const { trip } = useTrip();
  const { user, profile } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const [caption, setCaption] = useState('');
  const [mediaUri, setMediaUri] = useState<string | undefined>();
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [loading, setLoading] = useState(false);

  async function pickMedia() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.85,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setMediaUri(asset.uri);
        setMediaType(asset.type === 'video' ? 'video' : 'image');
      }
    } catch (e) {
      showError(e, 'Falha ao selecionar mídia');
    }
  }

  async function onPublish() {
    if (!trip || !user || !profile) {
      showError('Sessão ou viagem indisponível.', 'Não foi possível publicar');
      return;
    }
    if (!mediaUri) {
      showError('Selecione uma foto ou vídeo.', 'Mídia obrigatória');
      return;
    }
    try {
      setLoading(true);
      await createFeedPost({
        tripId: trip.id,
        authorUid: user.uid,
        authorName: profile.displayName,
        caption,
        mediaUri,
        mediaType,
      });
      showSuccess('Publicado no feed');
      router.back();
    } catch (e) {
      showError(e, 'Falha ao publicar');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen style={{ backgroundColor: '#0C0A09' }}>
      <View style={styles.form}>
        <Button
          title={mediaUri ? 'Mídia selecionada' : 'Escolher foto ou vídeo'}
          variant="secondary"
          onPress={pickMedia}
        />
        <Input
          label="Legenda"
          value={caption}
          onChangeText={setCaption}
          placeholder="Esse pôr do sol..."
        />
        <Button title="Publicar no feed" onPress={onPublish} loading={loading} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, marginTop: spacing.md },
});
