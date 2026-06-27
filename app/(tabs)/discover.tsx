import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { ListRow } from '@/components/list-row';
import { LoadingScreen } from '@/components/loading-screen';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { listPublicDecks, type PublicDeck } from '@/lib/discover';

export default function DiscoverScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    try {
      setDecks(await listPublicDecks(query));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh the full list whenever the tab regains focus.
  useFocusEffect(
    useCallback(() => {
      load(search);
      // Only re-run on focus, not on each keystroke (search has its own submit).
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.searchRow}>
        <View
          style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <MaterialIcons name="search" size={20} color={theme.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load(search)}
            returnKeyType="search"
            placeholder="ค้นหาเด็คสาธารณะ"
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            style={[styles.searchInput, { color: theme.text }]}
          />
        </View>
      </View>

      {loading ? (
        <LoadingScreen />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(search)} />
      ) : decks.length === 0 ? (
        <EmptyState
          icon="explore"
          title="ยังไม่พบเด็คสาธารณะ"
          message="ลองเผยแพร่เด็คของคุณ หรือค้นด้วยคำอื่น"
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(search)} />}
        >
          {decks.map((deck) => (
            <ListRow
              key={deck.id}
              icon="public"
              iconColor={theme.tint}
              title={deck.title}
              subtitle={`โดย ${deck.creatorName ?? 'ไม่ทราบชื่อ'}`}
              rightText={`${deck.cardCount} ใบ`}
              onPress={() => router.push(`/deck-preview/${deck.id}`)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchRow: {
    padding: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
});
