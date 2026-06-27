import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ErrorState } from '@/components/error-state';
import { ListRow } from '@/components/list-row';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { copyFolder, getFolder } from '@/lib/folders';
import { listDecks } from '@/lib/decks';
import { getProfile } from '@/lib/profiles';
import type { DeckWithCount, Folder } from '@/lib/types';

export default function FolderPreviewScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { id: folderId } = useLocalSearchParams<{ id: string }>();

  const [folder, setFolder] = useState<Folder | null>(null);
  const [decks, setDecks] = useState<DeckWithCount[]>([]);
  const [creator, setCreator] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const nextFolder = await getFolder(folderId);
      if (!nextFolder) throw new Error('Folder not found or not public');
      const [nextDecks, profile] = await Promise.all([
        listDecks(folderId),
        getProfile(nextFolder.ownerId),
      ]);
      setFolder(nextFolder);
      setDecks(nextDecks);
      setCreator(profile?.displayName ?? null);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCopy() {
    if (copying) return;
    setCopying(true);
    try {
      const newId = await copyFolder(folderId);
      Alert.alert('Added to library', 'The folder was copied to your library.', [
        { text: 'View folder', onPress: () => router.replace(`/folder/${newId}`) },
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
        <Stack.Screen options={{ title: 'Folder preview' }} />
        <LoadingScreen />
      </View>
    );
  }

  if (error || !folder) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ title: 'Folder preview' }} />
        <ErrorState message={error ?? undefined} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ title: 'Folder preview' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title">{folder.name}</ThemedText>
        <ThemedText style={[styles.meta, { color: theme.muted }]}>
          by {creator ?? 'Unknown'} · {decks.length} decks
        </ThemedText>

        {decks.length > 0 ? (
          <>
            <ThemedText type="defaultSemiBold" style={styles.sectionLabel}>
              Decks in this folder
            </ThemedText>
            {decks.map((deck) => (
              <ListRow
                key={deck.id}
                icon="style"
                iconColor={theme.success}
                title={deck.title}
                subtitle={deck.description ?? undefined}
                rightText={`${deck.cardCount} cards`}
              />
            ))}
          </>
        ) : null}
      </ScrollView>

      <View
        style={[styles.footer, { borderTopColor: theme.border, backgroundColor: theme.background }]}
      >
        <Button
          label="Add to library"
          onPress={handleCopy}
          loading={copying}
          disabled={decks.length === 0}
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
  sectionLabel: {
    marginTop: Spacing.sm,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
});
