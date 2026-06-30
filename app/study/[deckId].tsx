import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { LoadingScreen } from '@/components/loading-screen';
import { MarkdownText } from '@/components/markdown-text';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { listCards } from '@/lib/cards';
import { getDeck } from '@/lib/decks';
import { getDueCards, recordReview } from '@/lib/reviews';
import {
  getStudyPrefs,
  loadStudyPrefs,
  subscribeStudyPrefs,
  type StudyPrefs,
} from '@/lib/study-preference';
import type { Card, Deck } from '@/lib/types';

const SWIPE_THRESHOLD = 110;

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
  const { deckId, due } = useLocalSearchParams<{ deckId: string; due?: string }>();
  const dueOnly = due === '1';

  const [deck, setDeck] = useState<Deck | null>(null);
  const [order, setOrder] = useState<Card[]>([]);
  const rawCards = useRef<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studyPrefs, setStudyPrefsState] = useState<StudyPrefs>(getStudyPrefs());

  useEffect(() => {
    loadStudyPrefs().then(setStudyPrefsState);
    return subscribeStudyPrefs(setStudyPrefsState);
  }, []);

  const [index, setIndex] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);

  const flip = useSharedValue(0);
  const translateX = useSharedValue(0);
  const [showingBack, setShowingBack] = useState(false);

  const frontLabel = deck?.frontLabel ?? 'Front';
  const backLabel = deck?.backLabel ?? 'Back';

  const start = useCallback(
    (cards: Card[], loadedDeck?: Deck | null) => {
      const d = loadedDeck !== undefined ? loadedDeck : deck;
      const effectiveOrder = d?.studyOrder ?? studyPrefs.defaultStudyOrder;
      setOrder(effectiveOrder === 'random' ? shuffle(cards) : cards);
      setIndex(0);
      setCorrect(0);
      setFinished(false);
      setShowingBack(false);
      flip.value = 0;
      translateX.value = 0;
    },
    [deck, flip, translateX]
  );

  const loadSession = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedDeck, cards] = await Promise.all([
        getDeck(deckId),
        dueOnly ? getDueCards(deckId) : listCards(deckId),
      ]);
      setDeck(loadedDeck);
      rawCards.current = cards;
      start(cards, loadedDeck);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }, [deckId, dueOnly, start]);

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
  const swipeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { rotateZ: `${interpolate(translateX.value, [-220, 220], [-12, 12])}deg` },
    ],
  }));
  const yesHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], 'clamp'),
  }));
  const noHintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], 'clamp'),
  }));

  function toggleFlip() {
    const next = !showingBack;
    setShowingBack(next);
    flip.value = withTiming(next ? 1 : 0, { duration: 300 });
  }

  const advance = useCallback(
    (remembered: boolean) => {
      const card = order[index];
      if (card) void recordReview(card.id, remembered).catch(() => {});
      if (remembered) setCorrect((c) => c + 1);
      translateX.value = 0;
      flip.value = 0;
      setShowingBack(false);
      if (index + 1 >= order.length) {
        setFinished(true);
        return;
      }
      setIndex((i) => i + 1);
    },
    [order, index, translateX, flip]
  );

  const pan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-20, 20])
        .onUpdate((e) => {
          translateX.value = e.translationX;
        })
        .onEnd((e) => {
          if (e.translationX > SWIPE_THRESHOLD) runOnJS(advance)(true);
          else if (e.translationX < -SWIPE_THRESHOLD) runOnJS(advance)(false);
          else translateX.value = withSpring(0);
        }),
    [advance, translateX]
  );

  const cardTextStyle = useMemo(
    () => ({
      ...styles.cardText,
      ...(studyPrefs.cardFontSize === 'large' ? styles.cardTextLarge : {}),
    }),
    [studyPrefs.cardFontSize]
  );

  const current = order[index];
  const progress = useMemo(
    () => (order.length > 0 ? `${index + 1} / ${order.length}` : ''),
    [index, order.length]
  );
  const title = deck?.title ?? 'Study';

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
          icon={dueOnly ? 'check-circle' : 'inbox'}
          title={dueOnly ? 'Great! All caught up' : 'This deck has no cards yet'}
          message={
            dueOnly
              ? 'No cards are due right now. Check back later.'
              : 'Add some cards first, then come back to study.'
          }
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
        <ThemedText type="subtitle">Done!</ThemedText>
        <ThemedText style={[styles.summary, { color: theme.muted }]}>
          Remembered {correct} of {order.length} cards
        </ThemedText>
        <View style={styles.summaryActions}>
          <Button
            label="Restart"
            onPress={() => start(rawCards.current)}
            style={styles.summaryButton}
          />
          <Button
            label="Back"
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

      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.cardArea, swipeStyle]}>
          <Pressable style={styles.cardWrapper} onPress={toggleFlip}>
            {current ? (
              <>
                <Animated.View
                  style={[
                    styles.card,
                    { backgroundColor: theme.card, borderColor: theme.border },
                    frontStyle,
                  ]}
                >
                  <ThemedText style={[styles.face, { color: theme.muted }]}>
                    {frontLabel}
                  </ThemedText>
                  <MarkdownText content={current.front} style={cardTextStyle} />
                  <ThemedText style={[styles.hint, { color: theme.muted }]}>
                    Tap to flip · swipe to grade
                  </ThemedText>
                </Animated.View>
                <Animated.View
                  style={[
                    styles.card,
                    styles.cardBack,
                    { backgroundColor: theme.card, borderColor: theme.tint },
                    backStyle,
                  ]}
                >
                  <ThemedText style={[styles.face, { color: theme.muted }]}>
                    {backLabel}
                  </ThemedText>
                  <MarkdownText content={current.back} style={cardTextStyle} />
                  <ThemedText style={[styles.hint, { color: theme.muted }]}>
                    Tap to flip back
                  </ThemedText>
                </Animated.View>

                <Animated.View style={[styles.swipeTag, styles.swipeTagRight, yesHintStyle]}>
                  <ThemedText style={[styles.swipeTagText, { color: theme.success }]}>
                    Got it
                  </ThemedText>
                </Animated.View>
                <Animated.View style={[styles.swipeTag, styles.swipeTagLeft, noHintStyle]}>
                  <ThemedText style={[styles.swipeTagText, { color: theme.danger }]}>
                    Forgot
                  </ThemedText>
                </Animated.View>
              </>
            ) : null}
          </Pressable>
        </Animated.View>
      </GestureDetector>

      <View style={styles.gradeRow}>
        <Button
          label="Forgot"
          variant="danger"
          onPress={() => advance(false)}
          style={styles.gradeButton}
        />
        <Button label="Got it" onPress={() => advance(true)} style={styles.gradeButton} />
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
    fontWeight: 'bold',
    fontSize: 28,
    lineHeight: 36,
  },
  cardTextLarge: {
    fontSize: 38,
    lineHeight: 48,
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
  swipeTag: {
    position: 'absolute',
    top: Spacing.xl,
    borderWidth: 2,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  swipeTagRight: {
    left: Spacing.xl,
    borderColor: '#1f9d55',
    transform: [{ rotate: '-12deg' }],
  },
  swipeTagLeft: {
    right: Spacing.xl,
    borderColor: '#d7263d',
    transform: [{ rotate: '12deg' }],
  },
  swipeTagText: {
    fontSize: 18,
    fontWeight: '800',
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
