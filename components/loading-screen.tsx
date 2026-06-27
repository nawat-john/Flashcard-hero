import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useAppTheme } from '@/hooks/use-app-theme';

export function LoadingScreen() {
  const theme = useAppTheme();
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <ActivityIndicator size="large" color={theme.tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
