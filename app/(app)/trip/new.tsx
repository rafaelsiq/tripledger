import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DateField } from '@/src/components/DateField';
import { Button, Card, Input, Notice, PageHeader, Screen } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { daysFromTodayValue, todayValue } from '@/src/lib/dates';
import { getResolvedUserProfile } from '@/src/services/auth';
import { createTrip } from '@/src/services/trips';
import { spacing } from '@/src/theme';

export default function NewTripScreen() {
  const { user, profile } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(todayValue);
  const [endDate, setEndDate] = useState(() => daysFromTodayValue(7));
  const [loading, setLoading] = useState(false);

  function onStartDateChange(next: string) {
    setStartDate(next);
    if (endDate && next > endDate) {
      setEndDate(next);
    }
  }

  async function onCreate() {
    if (!user || !profile) {
      showError('Faça login para criar uma viagem.', 'Sessão necessária');
      return;
    }
    if (!name.trim()) {
      showError('Informe o nome da viagem.', 'Campo obrigatório');
      return;
    }
    if (!startDate || !endDate) {
      showError('Selecione as datas de início e fim.', 'Campo obrigatório');
      return;
    }
    if (endDate < startDate) {
      showError('A data de fim precisa ser igual ou posterior ao início.', 'Datas inválidas');
      return;
    }
    try {
      setLoading(true);
      const admin = await getResolvedUserProfile(user);
      const trip = await createTrip({
        name,
        destination,
        description,
        startDate,
        endDate,
        admin,
      });
      showSuccess('Viagem criada', trip.name);
      router.replace(`/(app)/trip/${trip.id}`);
    } catch (e) {
      showError(e, 'Não foi possível criar a viagem');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen narrow>
      <ScrollView contentContainerStyle={styles.form}>
        <PageHeader title="Nova viagem" subtitle="Dê um nome, destino e datas. O resto vem depois." />
        <Card style={styles.card}>
          <Input label="Nome da viagem" value={name} onChangeText={setName} placeholder="Réveillon Floripa" />
          <Input
            label="Destino"
            value={destination}
            onChangeText={setDestination}
            placeholder="Cidade, região ou país"
          />
          <View style={styles.dates}>
            <View style={styles.dateItem}>
              <DateField label="Ida" value={startDate} onChange={onStartDateChange} />
            </View>
            <View style={styles.dateItem}>
              <DateField
                label="Volta"
                value={endDate}
                onChange={setEndDate}
                minimumDate={startDate}
              />
            </View>
          </View>
          <Input
            label="Descrição (opcional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Combinados, objetivo da viagem…"
            multiline
            style={{ minHeight: 84, textAlignVertical: 'top' }}
          />
        </Card>
        <Notice
          tone="neutral"
          icon="information-circle-outline"
          message="Você será administrador e responsável financeiro. Dá para transferir depois em Membros."
        />
        <Button title="Criar viagem" onPress={onCreate} loading={loading} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.xxl },
  card: { gap: spacing.md },
  dates: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  dateItem: { flexGrow: 1, flexBasis: 150 },
});
