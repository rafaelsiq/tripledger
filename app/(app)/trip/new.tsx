import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { DateField } from '@/src/components/DateField';
import { Button, Input, Screen, Title, Body } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { daysFromTodayValue, todayValue } from '@/src/lib/dates';
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
      const trip = await createTrip({
        name,
        destination,
        description,
        startDate,
        endDate,
        admin: {
          uid: user.uid,
          displayName: profile.displayName,
          email: profile.email,
        },
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
    <Screen>
      <ScrollView contentContainerStyle={styles.form}>
        <Title>Nova viagem</Title>
        <Body muted>
          Você será o administrador e responsável financeiro. O orçamento nasce das despesas
          previstas que você lançar depois.
        </Body>
        <Input label="Nome" value={name} onChangeText={setName} placeholder="Réveillon Floripa" />
        <Input
          label="Destino"
          value={destination}
          onChangeText={setDestination}
          placeholder="Florianópolis"
        />
        <Input
          label="Descrição"
          value={description}
          onChangeText={setDescription}
          placeholder="Grupo de amigos"
        />
        <DateField
          label="Início"
          value={startDate}
          onChange={onStartDateChange}
          helperText="Toque para abrir o calendário"
        />
        <DateField
          label="Fim"
          value={endDate}
          onChange={setEndDate}
          minimumDate={startDate}
          helperText="Não pode ser antes do início"
        />
        <Button title="Criar viagem" onPress={onCreate} loading={loading} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.xxl },
});
