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
        throw new Error('ไม่พบเด็คนี้ หรือไม่ได้เปิดเป็นสาธารณะ');
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
      Alert.alert('เพิ่มเข้าคลังแล้ว', 'คัดลอกเด็คมาเป็นของคุณเรียบร้อย', [
        { text: 'ดูเด็ค', onPress: () => router.replace(`/deck/${newId}`) },
        { text: 'ปิด', style: 'cancel' },
      ]);
    } catch (e) {
      Alert.alert('คัดลอกไม่สำเร็จ', e instanceof Error ? e.message : 'ลองอีกครั้ง');
    } finally {
      setCopying(false);
    }
  }

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'ตัวอย่างเด็ค' }} />
        <LoadingScreen />
      </View>
    );
  }

  if (error || !deck) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'ตัวอย่างเด็ค' }} />
        <ErrorState message={error ?? undefined} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'ตัวอย่างเด็ค' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{deck.title}</ThemedText>
        <ThemedText style={[styles.meta, { color: theme.muted }]}>
          โดย {creator ?? 'ไม่ทราบชื่อ'} · {cards.length} ใบ
        </ThemedText>
        {deck.description ? <ThemedText style={styles.desc}>{deck.description}</ThemedText> : null}

        <ThemedText type="defaultSemiBold" style={styles.previewLabel}>
          ตัวอย่างการ์ด
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
          label="เพิ่มเข้าคลัง"
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
