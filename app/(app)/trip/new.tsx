import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Input, Screen, Title, Body } from '@/src/components/ui';
import { useAuth } from '@/src/hooks/useAuth';
import { useToast } from '@/src/hooks/useToast';
import { createTrip } from '@/src/services/trips';
import { spacing } from '@/src/theme';

export default function NewTripScreen() {
  const { user, profile } = useAuth();
  const { showError, showSuccess } = useToast();
  const router = useRouter();
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('2026-08-10');
  const [endDate, setEndDate] = useState('2026-08-17');
  const [budgetTotal, setBudgetTotal] = useState('5000');
  const [loading, setLoading] = useState(false);

  async function onCreate() {
    if (!user || !profile) {
      showError('Faça login para criar uma viagem.', 'Sessão necessária');
      return;
    }
    if (!name.trim()) {
      showError('Informe o nome da viagem.', 'Campo obrigatório');
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
        budgetTotal: Number(budgetTotal) || 0,
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
          Você será o administrador e responsável financeiro. Depois pode transferir o cargo.
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
        <Input label="Início (AAAA-MM-DD)" value={startDate} onChangeText={setStartDate} />
        <Input label="Fim (AAAA-MM-DD)" value={endDate} onChangeText={setEndDate} />
        <Input
          label="Orçamento total (R$)"
          keyboardType="decimal-pad"
          value={budgetTotal}
          onChangeText={setBudgetTotal}
        />
        <Button title="Criar viagem" onPress={onCreate} loading={loading} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.md, paddingBottom: spacing.xxl },
});
