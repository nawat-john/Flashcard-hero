import * as Linking from 'expo-linking';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, RefreshControl, ScrollView, Share, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { Fab } from '@/components/fab';
import { FormModal, type FormField } from '@/components/form-modal';
import { ListRow } from '@/components/list-row';
import { LoadingScreen } from '@/components/loading-screen';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import {
  createFolder,
  deleteFolder,
  getFolderPath,
  listFolders,
  renameFolder,
  shareFolder,
} from '@/lib/folders';
import { createDeck, deleteDeck, listDecks, setDeckPublic, updateDeck } from '@/lib/decks';
import type { DeckWithCount, Folder } from '@/lib/types';

type ModalState =
  | { kind: 'none' }
  | { kind: 'folder-create' }
  | { kind: 'folder-rename'; folder: Folder }
  | { kind: 'deck-create' }
  | { kind: 'deck-edit'; deck: DeckWithCount };

export function FolderBrowser({ folderId }: { folderId: string | null }) {
  const theme = useAppTheme();
  const router = useRouter();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [decks, setDecks] = useState<DeckWithCount[]>([]);
  const [path, setPath] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalState>({ kind: 'none' });

  const load = useCallback(async () => {
    try {
      const [nextFolders, nextDecks, nextPath] = await Promise.all([
        listFolders(folderId),
        listDecks(folderId),
        getFolderPath(folderId),
      ]);
      setFolders(nextFolders);
      setDecks(nextDecks);
      setPath(nextPath);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  // Reload whenever the screen regains focus (e.g. returning from a child folder).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function closeModal() {
    setModal({ kind: 'none' });
  }

  function promptCreate() {
    Alert.alert('Create new', 'What would you like to create?', [
      { text: 'Folder', onPress: () => setModal({ kind: 'folder-create' }) },
      { text: 'Deck', onPress: () => setModal({ kind: 'deck-create' }) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function confirmDeleteFolder(folder: Folder) {
    Alert.alert(
      `Delete "${folder.name}"?`,
      'All subfolders, decks, and cards inside will be deleted too.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteFolder(folder.id);
            load();
          },
        },
      ]
    );
  }

  function confirmDeleteDeck(deck: DeckWithCount) {
    Alert.alert(`Delete deck "${deck.title}"?`, 'All cards in this deck will be deleted too.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteDeck(deck.id);
          load();
        },
      },
    ]);
  }

  async function handleShareFolder(folder: Folder) {
    const next = !folder.isPublic;
    try {
      await shareFolder(folder.id, next);
      if (next) {
        const url = Linking.createURL(`/folder-preview/${folder.id}`);
        await Share.share({ message: `Study "${folder.name}" with me on Flashcard Hero!\n${url}` });
      }
      load();
    } catch (e) {
      Alert.alert('Update failed', e instanceof Error ? e.message : 'Please try again');
    }
  }

  function folderMenu(folder: Folder) {
    Alert.alert(folder.name, folder.isPublic ? 'Status: Public' : 'Status: Private', [
      { text: 'Rename', onPress: () => setModal({ kind: 'folder-rename', folder }) },
      {
        text: folder.isPublic ? 'Unpublish folder' : 'Publish folder',
        onPress: () => handleShareFolder(folder),
      },
      ...(folder.isPublic
        ? [
            {
              text: 'Share folder link',
              onPress: async () => {
                const url = Linking.createURL(`/folder-preview/${folder.id}`);
                await Share.share({
                  message: `Study "${folder.name}" with me on Flashcard Hero!\n${url}`,
                });
              },
            },
          ]
        : []),
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteFolder(folder) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  function deckMenu(deck: DeckWithCount) {
    Alert.alert(deck.title, deck.isPublic ? 'Status: Public' : 'Status: Private', [
      { text: 'Edit details', onPress: () => setModal({ kind: 'deck-edit', deck }) },
      {
        text: deck.isPublic ? 'Unpublish' : 'Publish',
        onPress: async () => {
          await setDeckPublic(deck.id, !deck.isPublic);
          load();
        },
      },
      { text: 'Delete', style: 'destructive', onPress: () => confirmDeleteDeck(deck) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  const isEmpty = folders.length === 0 && decks.length === 0;

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

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {path.length > 0 ? (
        <ThemedText numberOfLines={1} style={[styles.breadcrumb, { color: theme.muted }]}>
          {['Library', ...path.map((f) => f.name)].join('  ›  ')}
        </ThemedText>
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon="folder-open"
          title="Nothing here yet"
          message="Tap + to create your first folder or deck"
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        >
          {folders.map((folder) => (
            <ListRow
              key={`folder-${folder.id}`}
              icon="folder"
              title={folder.name}
              rightText={folder.isPublic ? '🌐' : undefined}
              onPress={() => router.push(`/folder/${folder.id}`)}
              onMorePress={() => folderMenu(folder)}
            />
          ))}
          {decks.map((deck) => (
            <ListRow
              key={`deck-${deck.id}`}
              icon="style"
              iconColor={theme.success}
              title={deck.title}
              subtitle={deck.description ?? undefined}
              rightText={`${deck.cardCount} cards${deck.isPublic ? ' · 🌐' : ''}`}
              onPress={() => router.push(`/deck/${deck.id}`)}
              onMorePress={() => deckMenu(deck)}
            />
          ))}
        </ScrollView>
      )}

      <Fab onPress={promptCreate} />

      <FormModal
        visible={modal.kind === 'folder-create'}
        title="New folder"
        fields={folderFields()}
        onSubmit={async (values) => {
          await createFolder(folderId, values.name);
          closeModal();
          load();
        }}
        onClose={closeModal}
      />
      <FormModal
        visible={modal.kind === 'folder-rename'}
        title="Rename folder"
        fields={folderFields(modal.kind === 'folder-rename' ? modal.folder.name : '')}
        onSubmit={async (values) => {
          if (modal.kind === 'folder-rename') {
            await renameFolder(modal.folder.id, values.name);
          }
          closeModal();
          load();
        }}
        onClose={closeModal}
      />
      <FormModal
        visible={modal.kind === 'deck-create'}
        title="New deck"
        fields={deckFields()}
        onSubmit={async (values) => {
          await createDeck(folderId, values.title, values.description);
          closeModal();
          load();
        }}
        onClose={closeModal}
      />
      <FormModal
        visible={modal.kind === 'deck-edit'}
        title="Edit deck"
        fields={
          modal.kind === 'deck-edit'
            ? deckFields(modal.deck.title, modal.deck.description ?? '')
            : deckFields()
        }
        onSubmit={async (values) => {
          if (modal.kind === 'deck-edit') {
            await updateDeck(modal.deck.id, values.title, values.description);
          }
          closeModal();
          load();
        }}
        onClose={closeModal}
      />
    </View>
  );
}

function folderFields(name = ''): FormField[] {
  return [
    {
      key: 'name',
      label: 'Folder name',
      placeholder: 'e.g. English',
      required: true,
      initialValue: name,
    },
  ];
}

function deckFields(title = '', description = ''): FormField[] {
  return [
    {
      key: 'title',
      label: 'Deck title',
      placeholder: 'e.g. Unit 1 Vocabulary',
      required: true,
      initialValue: title,
    },
    {
      key: 'description',
      label: 'Description (optional)',
      placeholder: 'Short description',
      multiline: true,
      initialValue: description,
    },
  ];
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  breadcrumb: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    fontSize: 13,
  },
  list: {
    padding: Spacing.lg,
    gap: Spacing.md,
    paddingBottom: 96,
  },
});
