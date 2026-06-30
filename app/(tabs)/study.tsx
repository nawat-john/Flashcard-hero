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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      setDecks(await listAllDecks());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const refreshControl = (
    <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} />
  );

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ErrorState message={error} onRetry={() => load()} />
      </View>
    );
  }

  if (decks.length === 0) {
    return (
      <ScrollView
        style={{ backgroundColor: theme.background }}
        contentContainerStyle={styles.empty}
        refreshControl={refreshControl}
      >
        <EmptyState
          icon="school"
          title="No decks to study yet"
          message="Create a deck in the Library tab, then come back here to start studying"
        />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.list}
      refreshControl={refreshControl}
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
  empty: {
    flexGrow: 1,
  },
});
