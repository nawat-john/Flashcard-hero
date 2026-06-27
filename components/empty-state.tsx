import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type EmptyStateProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  message?: string;
};

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.container}>
      <MaterialIcons name={icon} size={56} color={theme.muted} />
      <ThemedText type="subtitle" style={styles.title}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText style={[styles.message, { color: theme.muted }]}>{message}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  title: {
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
  },
});
