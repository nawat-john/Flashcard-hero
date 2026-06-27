import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { ListRow } from '@/components/list-row';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  listPublicDecks,
  listPublicFolders,
  type PublicDeck,
  type PublicFolder,
} from '@/lib/discover';

export default function DiscoverScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [folders, setFolders] = useState<PublicFolder[]>([]);
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (query: string) => {
    try {
      const [nextFolders, nextDecks] = await Promise.all([
        listPublicFolders(query),
        listPublicDecks(query),
      ]);
      setFolders(nextFolders);
      setDecks(nextDecks);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(search);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  const isEmpty = folders.length === 0 && decks.length === 0;

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
            placeholder="ค้นหาเด็คและโฟลเดอร์สาธารณะ"
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
      ) : isEmpty ? (
        <EmptyState
          icon="explore"
          title="ยังไม่พบเนื้อหาสาธารณะ"
          message="ลองเผยแพร่เด็คหรือโฟลเดอร์ของคุณ หรือค้นด้วยคำอื่น"
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={false} onRefresh={() => load(search)} />}
        >
          {folders.length > 0 ? (
            <>
              <ThemedText
                type="defaultSemiBold"
                style={[styles.sectionHeader, { color: theme.muted }]}
              >
                โฟลเดอร์
              </ThemedText>
              {folders.map((folder) => (
                <ListRow
                  key={folder.id}
                  icon="folder"
                  iconColor={theme.tint}
                  title={folder.name}
                  subtitle={`โดย ${folder.creatorName ?? 'ไม่ทราบชื่อ'}`}
                  rightText={`${folder.deckCount} เด็ค`}
                  onPress={() => router.push(`/folder-preview/${folder.id}` as any)}
                />
              ))}
            </>
          ) : null}

          {decks.length > 0 ? (
            <>
              <ThemedText
                type="defaultSemiBold"
                style={[styles.sectionHeader, { color: theme.muted }]}
              >
                เด็ค
              </ThemedText>
              {decks.map((deck) => (
                <ListRow
                  key={deck.id}
                  icon="public"
                  iconColor={theme.success}
                  title={deck.title}
                  subtitle={`โดย ${deck.creatorName ?? 'ไม่ทราบชื่อ'}`}
                  rightText={`${deck.cardCount} ใบ`}
                  onPress={() => router.push(`/deck-preview/${deck.id}`)}
                />
              ))}
            </>
          ) : null}
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
  sectionHeader: {
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
    marginBottom: -Spacing.xs,
  },
});
