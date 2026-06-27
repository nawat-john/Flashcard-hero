import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { FormModal, type FormField } from '@/components/form-modal';
import { ListRow } from '@/components/list-row';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { createCard, deleteCard, listCards, updateCard } from '@/lib/cards';
import { getDeck, setDeckPublic } from '@/lib/decks';
import type { Card, Deck } from '@/lib/types';

type ModalState = { kind: 'none' } | { kind: 'create' } | { kind: 'edit'; card: Card };

export default function DeckScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id: deckId } = useLocalSearchParams<{ id: string }>();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });

  const load = useCallback(async () => {
    try {
      const [nextDeck, nextCards] = await Promise.all([getDeck(deckId), listCards(deckId)]);
      setDeck(nextDeck);
      setCards(nextCards);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function closeModal() {
    setModal({ kind: 'none' });
  }

  async function handleTogglePublic(value: boolean) {
    if (!deck) return;
    setDeck({ ...deck, isPublic: value }); // optimistic
    try {
      await setDeckPublic(deck.id, value);
    } catch (e) {
      setDeck({ ...deck, isPublic: !value }); // revert on failure
      Alert.alert('อัปเดตไม่สำเร็จ', e instanceof Error ? e.message : 'ลองอีกครั้ง');
    }
  }

  async function handleShare() {
    if (!deck) return;
    const url = Linking.createURL(`/deck-preview/${deck.id}`);
    await Share.share({ message: `มาเรียน "${deck.title}" กันใน Flashcard Hero!\n${url}` });
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

      {loading ? (
        <LoadingScreen />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : cards.length === 0 ? (
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
          <View
            style={[styles.publishBar, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <View style={styles.publishText}>
              <ThemedText type="defaultSemiBold">เผยแพร่สู่สาธารณะ</ThemedText>
              <ThemedText style={[styles.publishHint, { color: theme.muted }]}>
                {deck?.isPublic ? 'คนอื่นค้นเจอและคัดลอกได้' : 'เห็นเฉพาะคุณ'}
              </ThemedText>
            </View>
            <Switch value={!!deck?.isPublic} onValueChange={handleTogglePublic} />
          </View>
          {deck?.isPublic ? (
            <Button label="แชร์ลิงก์" variant="secondary" onPress={handleShare} />
          ) : null}
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

      {!loading && !error ? <Fab onPress={() => setModal({ kind: 'create' })} /> : null}

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
  publishBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  publishText: {
    flex: 1,
    gap: 2,
  },
  publishHint: {
    fontSize: 13,
  },
  studyButton: {
    marginBottom: Spacing.sm,
  },
});
