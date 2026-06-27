import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { listCards } from '@/lib/cards';
import { getDeck } from '@/lib/decks';
import type { Card } from '@/lib/types';

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export default function StudySessionScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { deckId } = useLocalSearchParams<{ deckId: string }>();

  const [title, setTitle] = useState('เรียน');
  const [order, setOrder] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const flip = useSharedValue(0);
  const [showingBack, setShowingBack] = useState(false);

  const start = useCallback(
    (cards: Card[]) => {
      setOrder(shuffle(cards));
      setIndex(0);
      setCorrect(0);
      setFinished(false);
      setShowingBack(false);
      flip.value = 0;
    },
    [flip]
  );

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const [deck, cards] = await Promise.all([getDeck(deckId), listCards(deckId)]);
      if (deck) setTitle(deck.title);
      start(cards);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }, [deckId, start]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const frontStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(flip.value, [0, 1], [0, 180])}deg` },
    ],
  }));
  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 1000 },
      { rotateY: `${interpolate(flip.value, [0, 1], [180, 360])}deg` },
    ],
  }));

  function toggleFlip() {
    const next = !showingBack;
    setShowingBack(next);
    flip.value = withTiming(next ? 1 : 0, { duration: 300 });
  }

  function grade(remembered: boolean) {
    if (remembered) setCorrect((c) => c + 1);
    if (index + 1 >= order.length) {
      setFinished(true);
      return;
    }
    setIndex((i) => i + 1);
    setShowingBack(false);
    flip.value = 0;
  }

  const current = order[index];
  const progress = useMemo(
    () => (order.length > 0 ? `${index + 1} / ${order.length}` : ''),
    [index, order.length]
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title }} />
        <LoadingScreen />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title }} />
        <ErrorState message={error} onRetry={loadSession} />
      </View>
    );
  }

  if (order.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title }} />
        <EmptyState
          icon="inbox"
          title="เด็คนี้ยังไม่มีการ์ด"
          message="เพิ่มการ์ดก่อนแล้วค่อยกลับมาเรียน"
        />
      </View>
    );
  }

  if (finished) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title }} />
        <ThemedText type="title" style={styles.summaryEmoji}>
          🎉
        </ThemedText>
        <ThemedText type="subtitle">เรียนจบแล้ว!</ThemedText>
        <ThemedText style={[styles.summary, { color: theme.muted }]}>
          จำได้ {correct} จาก {order.length} ใบ
        </ThemedText>
        <View style={styles.summaryActions}>
          <Button label="เริ่มใหม่" onPress={() => start(order)} style={styles.summaryButton} />
          <Button
            label="กลับ"
            variant="secondary"
            onPress={() => router.back()}
            style={styles.summaryButton}
          />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title }} />

      <ThemedText style={[styles.progress, { color: theme.muted }]}>{progress}</ThemedText>

      <Pressable style={styles.cardArea} onPress={toggleFlip}>
        {current ? (
          <View style={styles.cardWrapper}>
            <Animated.View
              style={[
                styles.card,
                { backgroundColor: theme.card, borderColor: theme.border },
                frontStyle,
              ]}
            >
              <ThemedText style={[styles.face, { color: theme.muted }]}>คำถาม</ThemedText>
              <ThemedText type="title" style={styles.cardText}>
                {current.front}
              </ThemedText>
              <ThemedText style={[styles.hint, { color: theme.muted }]}>แตะเพื่อพลิก</ThemedText>
            </Animated.View>
            <Animated.View
              style={[
                styles.card,
                styles.cardBack,
                { backgroundColor: theme.card, borderColor: theme.tint },
                backStyle,
              ]}
            >
              <ThemedText style={[styles.face, { color: theme.muted }]}>คำตอบ</ThemedText>
              <ThemedText type="title" style={styles.cardText}>
                {current.back}
              </ThemedText>
              <ThemedText style={[styles.hint, { color: theme.muted }]}>
                แตะเพื่อพลิกกลับ
              </ThemedText>
            </Animated.View>
          </View>
        ) : null}
      </Pressable>

      <View style={styles.gradeRow}>
        <Button
          label="จำไม่ได้"
          variant="danger"
          onPress={() => grade(false)}
          style={styles.gradeButton}
        />
        <Button label="จำได้" onPress={() => grade(true)} style={styles.gradeButton} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.lg,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  progress: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: Spacing.sm,
  },
  cardArea: {
    flex: 1,
    justifyContent: 'center',
  },
  cardWrapper: {
    flex: 1,
  },
  card: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    backfaceVisibility: 'hidden',
  },
  cardBack: {
    borderWidth: 2,
  },
  cardText: {
    textAlign: 'center',
  },
  face: {
    position: 'absolute',
    top: Spacing.lg,
    fontSize: 13,
    letterSpacing: 1,
  },
  hint: {
    position: 'absolute',
    bottom: Spacing.lg,
    fontSize: 13,
  },
  gradeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  gradeButton: {
    flex: 1,
  },
  summaryEmoji: {
    fontSize: 48,
    lineHeight: 56,
  },
  summary: {
    fontSize: 16,
  },
  summaryActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  summaryButton: {
    minWidth: 120,
  },
});
