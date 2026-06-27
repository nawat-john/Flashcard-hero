import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type FabProps = {
  icon?: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
};

export function Fab({ icon = 'add', onPress }: FabProps) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: theme.tint, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <MaterialIcons name={icon} size={28} color="#fff" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    bottom: Spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
