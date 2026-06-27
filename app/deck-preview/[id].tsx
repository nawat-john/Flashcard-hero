import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorState } from '@/components/error-state';
import { ListRow } from '@/components/list-row';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { listCards } from '@/lib/cards';
import { copyDeck, getDeck } from '@/lib/decks';
import { getProfile } from '@/lib/profiles';
import type { Card, Deck } from '@/lib/types';

export default function DeckPreviewScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id: deckId } = useLocalSearchParams<{ id: string }>();

  const [deck, setDeck] = useState<Deck | null>(null);
  const [creator, setCreator] = useState<string | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nextDeck = await getDeck(deckId);
      if (!nextDeck) {
        throw new Error('Deck not found or not public');
      }
      const [nextCards, profile] = await Promise.all([
        listCards(deckId),
        getProfile(nextDeck.ownerId),
      ]);
      setDeck(nextDeck);
      setCards(nextCards);
      setCreator(profile?.displayName ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }, [deckId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCopy() {
    if (copying) return;
    setCopying(true);
    try {
      const newId = await copyDeck(deckId);
      Alert.alert('Added to library', 'The deck was copied to your library.', [
        { text: 'View deck', onPress: () => router.replace(`/deck/${newId}`) },
        { text: 'Close', style: 'cancel' },
      ]);
    } catch (e) {
      Alert.alert('Copy failed', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setCopying(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Deck preview' }} />
        <LoadingScreen />
      </View>
    );
  }

  if (error || !deck) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Deck preview' }} />
        <ErrorState message={error ?? undefined} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Deck preview' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{deck.title}</ThemedText>
        <ThemedText style={[styles.meta, { color: theme.muted }]}>
          by {creator ?? 'Unknown'} · {cards.length} cards
        </ThemedText>
        {deck.description ? <ThemedText style={styles.desc}>{deck.description}</ThemedText> : null}

        <ThemedText type="defaultSemiBold" style={styles.previewLabel}>
          Card preview
        </ThemedText>
        {cards.map((card, index) => (
          <ListRow
            key={card.id}
            icon="credit-card"
            title={card.front}
            subtitle={card.back}
            rightText={`${index + 1}`}
          />
        ))}
      </ScrollView>

      <View
        style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}
      >
        <Button
          label="Add to library"
          onPress={handleCopy}
          loading={copying}
          disabled={cards.length === 0}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  meta: {
    fontSize: 14,
  },
  desc: {
    lineHeight: 22,
  },
  previewLabel: {
    marginTop: Spacing.sm,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    gap: Spacing.md,
    borderRadius: Radius.sm,
  },
});
