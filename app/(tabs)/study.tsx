import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ListRow } from '@/components/list-row';
import { useAppTheme } from '@/hooks/use-app-theme';
import { Spacing } from '@/constants/theme';
import { listAllDecks } from '@/lib/decks';
import type { DeckWithCount } from '@/lib/types';

export default function StudyTabScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const [decks, setDecks] = useState<DeckWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setDecks(await listAllDecks());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (decks.length === 0 && !loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <EmptyState
          icon="school"
          title="ยังไม่มีเด็คให้เรียน"
          message="สร้างเด็คในแท็บ “คลังของฉัน” แล้วกลับมาที่นี่เพื่อเริ่มเรียน"
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
          rightText={`${deck.cardCount} ใบ`}
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
