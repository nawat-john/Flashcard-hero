import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { listAllFolders } from '@/lib/folders';
import type { Folder } from '@/lib/types';

type Item = { id: string | null; name: string };

type Props = {
  visible: boolean;
  title?: string;
  onSelect: (folderId: string | null) => void;
  onClose: () => void;
};

export function FolderPickerModal({
  visible,
  title = 'Select folder',
  onSelect,
  onClose,
}: Props) {
  const theme = useAppTheme();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    listAllFolders()
      .then(setFolders)
      .finally(() => setLoading(false));
  }, [visible]);

  const items: Item[] = [{ id: null, name: 'Library root (no folder)' }, ...folders];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={[styles.header, { borderBottomColor: theme.border }]}>
            <ThemedText type="defaultSemiBold">{title}</ThemedText>
            <Pressable onPress={onClose} hitSlop={8}>
              <MaterialIcons name="close" size={22} color={theme.muted} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.tint} />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id ?? '__root__'}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomColor: theme.border, opacity: pressed ? 0.6 : 1 },
                  ]}
                  onPress={() => onSelect(item.id)}
                >
                  <MaterialIcons
                    name={item.id ? 'folder' : 'home'}
                    size={20}
                    color={item.id ? theme.tint : theme.success}
                  />
                  <ThemedText style={styles.rowText}>{item.name}</ThemedText>
                  <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
                </Pressable>
              )}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  loadingRow: {
    padding: Spacing.xl,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: {
    flex: 1,
  },
});
