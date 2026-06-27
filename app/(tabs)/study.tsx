import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { ListRow } from '@/components/list-row';
import { LoadingScreen } from '@/components/loading-screen';
import { useAppTheme } from '@/hooks/use-app-theme';
import { Spacing } from '@/constants/theme';
import { listAllDecks } from '@/lib/decks';
import type { DeckWithCount } from '@/lib/types';

export default function StudyTabScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [decks, setDecks] = useState<DeckWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setDecks(await listAllDecks());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }

  if (decks.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <EmptyState
          icon="school"
          title="No decks to study yet"
          message="Create a deck in the Library tab, then come back here to start studying"
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      {decks.map((deck) => (
        <ListRow
          key={deck.id}
          icon="style"
          iconColor={theme.success}
          title={deck.title}
          subtitle={deck.description ?? undefined}
          rightText={`${deck.cardCount} cards`}
          onPress={() => router.push(`/study/${deck.id}`)}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
});
