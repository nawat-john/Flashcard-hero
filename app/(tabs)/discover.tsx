import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

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
  const [activeTag, setActiveTag] = useState('');
  const [folders, setFolders] = useState<PublicFolder[]>([]);
  const [decks, setDecks] = useState<PublicDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (query: string, tag: string, isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      try {
        const [nextFolders, nextDecks] = await Promise.all([
          listPublicFolders(query),
          listPublicDecks(query, tag),
        ]);
        setFolders(nextFolders);
        setDecks(nextDecks);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'unknown error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      load(search, activeTag);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load])
  );

  // Collect unique tags from all loaded decks for the filter chips.
  const allTags = useMemo(() => {
    const set = new Set<string>();
    decks.forEach((d) => d.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [decks]);

  function selectTag(tag: string) {
    const next = tag === activeTag ? '' : tag;
    setActiveTag(next);
    load(search, next);
  }

  const isEmpty = folders.length === 0 && decks.length === 0;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Search bar */}
      <View style={styles.searchRow}>
        <View
          style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}
        >
          <MaterialIcons name="search" size={20} color={theme.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => load(search, activeTag)}
            returnKeyType="search"
            placeholder="Search public decks and folders"
            placeholderTextColor={theme.muted}
            autoCapitalize="none"
            style={[styles.searchInput, { color: theme.text }]}
          />
          {search.length > 0 ? (
            <Pressable
              onPress={() => {
                setSearch('');
                load('', activeTag);
              }}
              hitSlop={8}
            >
              <MaterialIcons name="close" size={18} color={theme.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* Tag filter chips */}
      {allTags.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagRow}
        >
          {allTags.map((tag) => (
            <Pressable
              key={tag}
              onPress={() => selectTag(tag)}
              style={[
                styles.tagChip,
                {
                  backgroundColor: activeTag === tag ? theme.tint : theme.card,
                  borderColor: activeTag === tag ? theme.tint : theme.border,
                },
              ]}
            >
              <ThemedText
                style={[
                  styles.tagChipText,
                  { color: activeTag === tag ? '#fff' : theme.muted },
                ]}
              >
                #{tag}
              </ThemedText>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      {loading ? (
        <LoadingScreen />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(search, activeTag)} />
      ) : isEmpty ? (
        <ScrollView
          contentContainerStyle={styles.emptyContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(search, activeTag, true)} />
          }
        >
          <EmptyState
            icon="explore"
            title="No public content found"
            message={
              activeTag
                ? `No decks tagged #${activeTag}`
                : 'Try publishing a deck or folder, or search for something else'
            }
          />
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(search, activeTag, true)} />
          }
        >
          {folders.length > 0 ? (
            <>
              <ThemedText
                type="defaultSemiBold"
                style={[styles.sectionHeader, { color: theme.muted }]}
              >
                Folders
              </ThemedText>
              {folders.map((folder) => (
                <ListRow
                  key={folder.id}
                  icon="folder"
                  iconColor={theme.tint}
                  title={folder.name}
                  subtitle={`by ${folder.creatorName ?? 'Unknown'}`}
                  rightText={`${folder.deckCount} decks`}
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
                Decks
              </ThemedText>
              {decks.map((deck) => (
                <ListRow
                  key={deck.id}
                  icon="public"
                  iconColor={theme.success}
                  title={deck.title}
                  subtitle={[
                    `by ${deck.creatorName ?? 'Unknown'}`,
                    ...deck.tags.map((t) => `#${t}`),
                  ].join('  ·  ')}
                  rightText={`${deck.cardCount} cards`}
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
  tagRow: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    flexDirection: 'row',
  },
  tagChip: {
    borderWidth: 1,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  tagChipText: {
    fontSize: 13,
  },
  list: {
    padding: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
  emptyContainer: {
    flexGrow: 1,
  },
  sectionHeader: {
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.sm,
    marginBottom: -Spacing.xs,
  },
});
