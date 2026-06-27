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
    Alert.alert('สร้างใหม่', 'อยากสร้างอะไร?', [
      { text: 'โฟลเดอร์', onPress: () => setModal({ kind: 'folder-create' }) },
      { text: 'เด็ค', onPress: () => setModal({ kind: 'deck-create' }) },
      { text: 'ยกเลิก', style: 'cancel' },
    ]);
  }

  function confirmDeleteFolder(folder: Folder) {
    Alert.alert(`ลบ "${folder.name}"?`, 'โฟลเดอร์ย่อย เด็ค และการ์ดทั้งหมดข้างในจะถูกลบด้วย', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
        style: 'destructive',
        onPress: async () => {
          await deleteFolder(folder.id);
          load();
        },
      },
    ]);
  }

  function confirmDeleteDeck(deck: DeckWithCount) {
    Alert.alert(`ลบเด็ค "${deck.title}"?`, 'การ์ดทั้งหมดในเด็คนี้จะถูกลบด้วย', [
      { text: 'ยกเลิก', style: 'cancel' },
      {
        text: 'ลบ',
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
        await Share.share({ message: `มาเรียน "${folder.name}" กันใน Flashcard Hero!\n${url}` });
      }
      load();
    } catch (e) {
      Alert.alert('อัปเดตไม่สำเร็จ', e instanceof Error ? e.message : 'ลองอีกครั้ง');
    }
  }

  function folderMenu(folder: Folder) {
    Alert.alert(folder.name, folder.isPublic ? 'สถานะ: เผยแพร่' : 'สถานะ: ส่วนตัว', [
      { text: 'เปลี่ยนชื่อ', onPress: () => setModal({ kind: 'folder-rename', folder }) },
      {
        text: folder.isPublic ? 'เลิกเผยแพร่โฟลเดอร์' : 'เผยแพร่โฟลเดอร์สู่สาธารณะ',
        onPress: () => handleShareFolder(folder),
      },
      ...(folder.isPublic
        ? [
            {
              text: 'แชร์ลิงก์โฟลเดอร์',
              onPress: async () => {
                const url = Linking.createURL(`/folder-preview/${folder.id}`);
                await Share.share({
                  message: `มาเรียน "${folder.name}" กันใน Flashcard Hero!\n${url}`,
                });
              },
            },
          ]
        : []),
      { text: 'ลบ', style: 'destructive', onPress: () => confirmDeleteFolder(folder) },
      { text: 'ยกเลิก', style: 'cancel' },
    ]);
  }

  function deckMenu(deck: DeckWithCount) {
    Alert.alert(deck.title, deck.isPublic ? 'สถานะ: เผยแพร่' : 'สถานะ: ส่วนตัว', [
      { text: 'แก้ไขรายละเอียด', onPress: () => setModal({ kind: 'deck-edit', deck }) },
      {
        text: deck.isPublic ? 'เลิกเผยแพร่' : 'เผยแพร่สู่สาธารณะ',
        onPress: async () => {
          await setDeckPublic(deck.id, !deck.isPublic);
          load();
        },
      },
      { text: 'ลบ', style: 'destructive', onPress: () => confirmDeleteDeck(deck) },
      { text: 'ยกเลิก', style: 'cancel' },
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
          {['คลังของฉัน', ...path.map((f) => f.name)].join('  ›  ')}
        </ThemedText>
      ) : null}

      {isEmpty ? (
        <EmptyState
          icon="folder-open"
          title="ยังว่างอยู่"
          message="แตะปุ่ม + เพื่อสร้างโฟลเดอร์หรือเด็คแรกของคุณ"
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
              rightText={`${deck.cardCount} ใบ${deck.isPublic ? ' · 🌐' : ''}`}
              onPress={() => router.push(`/deck/${deck.id}`)}
              onMorePress={() => deckMenu(deck)}
            />
          ))}
        </ScrollView>
      )}

      <Fab onPress={promptCreate} />

      <FormModal
        visible={modal.kind === 'folder-create'}
        title="โฟลเดอร์ใหม่"
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
        title="เปลี่ยนชื่อโฟลเดอร์"
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
        title="เด็คใหม่"
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
        title="แก้ไขเด็ค"
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
      label: 'ชื่อโฟลเดอร์',
      placeholder: 'เช่น ภาษาอังกฤษ',
      required: true,
      initialValue: name,
    },
  ];
}

function deckFields(title = '', description = ''): FormField[] {
  return [
    {
      key: 'title',
      label: 'ชื่อเด็ค',
      placeholder: 'เช่น คำศัพท์ Unit 1',
      required: true,
      initialValue: title,
    },
    {
      key: 'description',
      label: 'คำอธิบาย (ไม่บังคับ)',
      placeholder: 'อธิบายสั้นๆ',
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
