import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.container}>
      <MaterialIcons name="cloud-off" size={56} color={theme.muted} />
      <ThemedText type="subtitle" style={styles.title}>
        โหลดข้อมูลไม่สำเร็จ
      </ThemedText>
      {message ? (
        <ThemedText style={[styles.message, { color: theme.muted }]}>{message}</ThemedText>
      ) : null}
      {onRetry ? <Button label="ลองอีกครั้ง" onPress={onRetry} style={styles.retry} /> : null}
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
  retry: {
    marginTop: Spacing.md,
    minWidth: 160,
  },
});
