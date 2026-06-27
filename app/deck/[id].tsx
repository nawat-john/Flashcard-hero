import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { Fab } from '@/components/fab';
import { FormModal, type FormField } from '@/components/form-modal';
import { ListRow } from '@/components/list-row';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { createCard, deleteCard, listCards, updateCard } from '@/lib/cards';
import { getDeck } from '@/lib/decks';
import type { Card, Deck } from '@/lib/types';

type ModalState = { kind: 'none' } | { kind: 'create' } | { kind: 'edit'; card: Card };

export default function DeckScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const deckId = Number(id);

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });

  const load = useCallback(async () => {
    const [nextDeck, nextCards] = await Promise.all([getDeck(deckId), listCards(deckId)]);
    setDeck(nextDeck);
    setCards(nextCards);
    setLoading(false);
  }, [deckId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function closeModal() {
    setModal({ kind: 'none' });
  }

  function cardMenu(card: Card) {
    Alert.alert('การ์ดนี้', undefined, [
      { text: 'แก้ไข', onPress: () => setModal({ kind: 'edit', card }) },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: () =>
          Alert.alert('ลบการ์ดนี้?', undefined, [
            { text: 'ยกเลิก', style: 'cancel' },
            {
              text: 'ลบ',
              style: 'destructive',
              onPress: async () => {
                await deleteCard(card.id);
                load();
              },
            },
          ]),
      },
      { text: 'ยกเลิก', style: 'cancel' },
    ]);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: deck?.title ?? 'เด็ค' }} />

      {cards.length === 0 && !loading ? (
        <EmptyState
          icon="add-card"
          title="ยังไม่มีการ์ด"
          message="แตะปุ่ม + เพื่อเพิ่มการ์ดใบแรก"
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        >
          {cards.length > 0 ? (
            <Button
              label={`เริ่มเรียน (${cards.length} ใบ)`}
              onPress={() => router.push(`/study/${deckId}`)}
              style={styles.studyButton}
            />
          ) : null}
          {cards.map((card, index) => (
            <ListRow
              key={card.id}
              icon="credit-card"
              title={card.front}
              subtitle={card.back}
              rightText={`${index + 1}`}
              onPress={() => setModal({ kind: 'edit', card })}
              onMorePress={() => cardMenu(card)}
            />
          ))}
        </ScrollView>
      )}

      <Fab onPress={() => setModal({ kind: 'create' })} />

      <FormModal
        visible={modal.kind === 'create'}
        title="เพิ่มการ์ด"
        fields={cardFields()}
        onSubmit={async (values) => {
          await createCard(deckId, values.front, values.back);
          closeModal();
          load();
        }}
        onClose={closeModal}
      />
      <FormModal
        visible={modal.kind === 'edit'}
        title="แก้ไขการ์ด"
        fields={
          modal.kind === 'edit' ? cardFields(modal.card.front, modal.card.back) : cardFields()
        }
        onSubmit={async (values) => {
          if (modal.kind === 'edit') {
            await updateCard(modal.card.id, values.front, values.back);
          }
          closeModal();
          load();
        }}
        onClose={closeModal}
      />
    </View>
  );
}

function cardFields(front = '', back = ''): FormField[] {
  return [
    {
      key: 'front',
      label: 'ด้านหน้า (คำถาม)',
      placeholder: 'เช่น apple',
      multiline: true,
      required: true,
      initialValue: front,
    },
    {
      key: 'back',
      label: 'ด้านหลัง (คำตอบ)',
      placeholder: 'เช่น แอปเปิล',
      multiline: true,
      required: true,
      initialValue: back,
    },
  ];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 96,
  },
  studyButton: {
    marginBottom: Spacing.sm,
  },
});
