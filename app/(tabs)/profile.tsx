import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export default function ProfileScreen() {
  const theme = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.avatar, { backgroundColor: theme.surface }]}>
        <MaterialIcons name="person" size={48} color={theme.muted} />
      </View>
      <ThemedText type="subtitle">โหมดออฟไลน์</ThemedText>
      <ThemedText style={[styles.note, { color: theme.muted }]}>
        ตอนนี้ข้อมูลทั้งหมดถูกเก็บไว้ในเครื่อง{'\n'}
        การเข้าสู่ระบบและการแชร์จะมาใน Phase ถัดไป
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  note: {
    textAlign: 'center',
    lineHeight: 22,
  },
});
