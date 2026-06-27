import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { isOnline, subscribeOnline } from '@/lib/store';

export function OfflineBanner() {
  const [offline, setOffline] = useState(!isOnline());

  useEffect(() => {
    return subscribeOnline((value) => setOffline(!value));
  }, []);

  if (!offline) return null;

  return (
    <View style={styles.banner}>
      <MaterialIcons name="cloud-off" size={16} color="#fff" />
      <ThemedText style={styles.text}>ออฟไลน์ — บันทึกไว้ จะซิงค์เมื่อมีอินเทอร์เน็ต</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: '#555',
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
  },
  text: {
    color: '#fff',
    fontSize: 12,
  },
});
