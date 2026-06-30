import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useRef, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, Switch, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { FormModal } from '@/components/form-modal';
import type { FormField } from '@/components/form-modal';
import { ListRow } from '@/components/list-row';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { createCard, deleteCard, listCards, reorderCards, updateCard } from '@/lib/cards';
import { getDeck, setDeckPublic, updateDeck, type DeckPatch } from '@/lib/decks';
import { countDueCards } from '@/lib/reviews';
import type { Card, Deck } from '@/lib/types';

const ROW_HEIGHT = 64; // approximate height of each ListRow

type ModalState =
  | { kind: 'none' }
  | { kind: 'create' }
  | { kind: 'edit'; card: Card }
  | { kind: 'config' };

// ---------------------------------------------------------------------------
// Draggable card row
// ---------------------------------------------------------------------------

type DragCardRowProps = {
  card: Card;
  index: number;
  total: number;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
  onDragEnd: (fromIndex: number, toIndex: number) => void;
};

function DragCardRow({ card, index, total, onEdit, onDelete, onDragEnd }: DragCardRowProps) {
  const theme = useAppTheme();
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const cardMenu = useCallback(() => {
    Alert.alert('Card', undefined, [
      { text: 'Edit', onPress: () => onEdit(card) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Delete this card?', undefined, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => onDelete(card) },
          ]),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }, [card, onEdit, onDelete]);

  const dispatchDragEnd = useCallback(
    (dy: number) => {
      const steps = Math.round(dy / ROW_HEIGHT);
      const newIndex = Math.max(0, Math.min(total - 1, index + steps));
      if (newIndex !== index) onDragEnd(index, newIndex);
    },
    [index, total, onDragEnd]
  );

  const pan = Gesture.Pan()
    .activateAfterLongPress(300)
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((e) => {
      translateY.value = e.translationY;
    })
    .onEnd((e) => {
      runOnJS(dispatchDragEnd)(e.translationY);
      translateY.value = withSpring(0);
      isDragging.value = false;
    });

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    zIndex: isDragging.value ? 999 : 0,
    shadowOpacity: isDragging.value ? 0.2 : 0,
    shadowRadius: isDragging.value ? 8 : 0,
    elevation: isDragging.value ? 6 : 0,
    backgroundColor: isDragging.value ? theme.card : 'transparent',
    borderRadius: isDragging.value ? Radius.md : 0,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={animStyle}>
        <ListRow
          icon="credit-card"
          title={card.front}
          subtitle={card.back}
          rightText={`${index + 1}`}
          onPress={() => onEdit(card)}
          onMorePress={cardMenu}
        />
      </Animated.View>
    </GestureDetector>
  );
}

// ---------------------------------------------------------------------------
// Deck screen
// ---------------------------------------------------------------------------

export default function DeckScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id: deckId } = useLocalSearchParams<{ id: string }>();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });
  // prevent double-submit during async reorder
  const reordering = useRef(false);

  const load = useCallback(async () => {
    try {
      const [nextDeck, nextCards, due] = await Promise.all([
        getDeck(deckId),
        listCards(deckId),
        countDueCards(deckId),
      ]);
      setDeck(nextDeck);
      setCards(nextCards);
      setDueCount(due);
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
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Please try again');
    }
  }

  async function handleShare() {
    if (!deck) return;
    const url = Linking.createURL(`/deck-preview/${deck.id}`);
    await Share.share({ message: `Study "${deck.title}" with me on Flashcard Hero!\n${url}` });
  }

  async function handleDragEnd(fromIndex: number, toIndex: number) {
    if (reordering.current) return;
    reordering.current = true;
    const next = [...cards];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    setCards(next); // optimistic update
    try {
      await reorderCards(
        deckId,
        next.map((c) => c.id)
      );
    } catch {
      setCards(cards); // revert
    } finally {
      reordering.current = false;
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: deck?.title ?? 'Deck' }} />

      {loading ? (
        <LoadingScreen />
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : cards.length === 0 ? (
        <EmptyState icon="add-card" title="No cards yet" message="Tap + to add your first card" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        >
          <View
            style={[styles.publishBar, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <View style={styles.publishText}>
              <ThemedText type="defaultSemiBold">Publish to public</ThemedText>
              <ThemedText style={[styles.publishHint, { color: theme.muted }]}>
                {deck?.isPublic ? 'Others can find and copy it' : 'Only visible to you'}
              </ThemedText>
            </View>
            <Switch value={!!deck?.isPublic} onValueChange={handleTogglePublic} />
          </View>
          {deck?.isPublic ? (
            <Button label="Share link" variant="secondary" onPress={handleShare} />
          ) : null}
          <View
            style={[styles.publishBar, { backgroundColor: theme.card, borderColor: theme.border }]}
          >
            <View style={styles.publishText}>
              <ThemedText type="defaultSemiBold">Deck settings</ThemedText>
              <ThemedText style={[styles.publishHint, { color: theme.muted }]}>
                {[
                  deck?.tags.length ? deck.tags.map((t) => `#${t}`).join(' ') : null,
                  deck?.frontLabel && deck.frontLabel !== 'Front'
                    ? `${deck.frontLabel} / ${deck.backLabel}`
                    : null,
                  deck?.studyOrder === 'random' ? 'Random order' : null,
                ]
                  .filter(Boolean)
                  .join('  ·  ') || 'Tags, labels, study order'}
              </ThemedText>
            </View>
            <Button
              label="Edit"
              variant="secondary"
              onPress={() => setModal({ kind: 'config' })}
              style={styles.tagsEditBtn}
            />
          </View>
          {dueCount > 0 ? (
            <Button
              label={`Review due (${dueCount})`}
              onPress={() =>
                router.push({ pathname: '/study/[deckId]', params: { deckId, due: '1' } })
              }
            />
          ) : null}
          <Button
            label={`Study all (${cards.length} cards)`}
            variant={dueCount > 0 ? 'secondary' : 'primary'}
            onPress={() => router.push(`/study/${deckId}`)}
            style={styles.studyButton}
          />
          <ThemedText style={[styles.dragHint, { color: theme.muted }]}>
            Long-press to drag and reorder
          </ThemedText>
          {cards.map((card, index) => (
            <DragCardRow
              key={card.id}
              card={card}
              index={index}
              total={cards.length}
              onEdit={(c) => setModal({ kind: 'edit', card: c })}
              onDelete={async (c) => {
                await deleteCard(c.id);
                load();
              }}
              onDragEnd={handleDragEnd}
            />
          ))}
        </ScrollView>
      )}

      {!loading && !error ? <Fab onPress={() => setModal({ kind: 'create' })} /> : null}

      <FormModal
        visible={modal.kind === 'config'}
        title="Deck settings"
        fields={deckConfigFields(deck ?? undefined)}
        onSubmit={async (values) => {
          if (!deck) return;
          const tags = values.tags
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean);
          const patch: DeckPatch = {
            tags,
            icon: values.icon.trim() || null,
            color: values.color || null,
            frontLabel: values.frontLabel.trim() || 'Front',
            backLabel: values.backLabel.trim() || 'Back',
            studyOrder: values.studyOrder === 'random' ? 'random' : 'sequential',
          };
          await updateDeck(deck.id, patch);
          setDeck({ ...deck, ...patch, tags } as typeof deck);
          closeModal();
        }}
        onClose={closeModal}
      />
      <FormModal
        visible={modal.kind === 'create'}
        title="Add card"
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
        title="Edit card"
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

function deckConfigFields(deck?: { tags: string[]; icon: string | null; color: string | null; frontLabel: string; backLabel: string; studyOrder: string }): FormField[] {
  return [
    {
      key: 'tags',
      label: 'Tags (comma-separated)',
      placeholder: 'e.g. english, vocabulary',
      initialValue: deck?.tags.join(', ') ?? '',
      maxLength: 200,
    },
    {
      key: 'icon',
      label: 'Icon (emoji, optional)',
      placeholder: 'e.g. 🃏',
      initialValue: deck?.icon ?? '',
      maxLength: 4,
    },
    {
      key: 'color',
      label: 'Color',
      type: 'color' as const,
      initialValue: deck?.color ?? '',
    },
    {
      key: 'frontLabel',
      label: 'Front side label (default: Front)',
      placeholder: 'e.g. Word, Question, Term',
      initialValue: deck?.frontLabel && deck.frontLabel !== 'Front' ? deck.frontLabel : '',
      maxLength: 30,
    },
    {
      key: 'backLabel',
      label: 'Back side label (default: Back)',
      placeholder: 'e.g. Definition, Answer, Translation',
      initialValue: deck?.backLabel && deck.backLabel !== 'Back' ? deck.backLabel : '',
      maxLength: 30,
    },
    {
      key: 'studyOrder',
      label: 'Study order',
      type: 'select' as const,
      initialValue: deck?.studyOrder ?? 'sequential',
      options: [
        { value: 'sequential', label: 'In order' },
        { value: 'random', label: 'Random' },
      ],
    },
  ];
}

function cardFields(front = '', back = ''): FormField[] {
  return [
    {
      key: 'front',
      label: 'Front (question)',
      placeholder: 'e.g. apple',
      multiline: true,
      required: true,
      initialValue: front,
      maxLength: 2000,
    },
    {
      key: 'back',
      label: 'Back (answer)',
      placeholder: 'e.g. a round fruit',
      multiline: true,
      required: true,
      initialValue: back,
      maxLength: 2000,
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
  tagsEditBtn: {
    paddingHorizontal: Spacing.md,
  },
  dragHint: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: -Spacing.xs,
  },
});
