import { ActivityIndicator, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: ButtonProps) {
  const theme = useAppTheme();

  const backgrounds: Record<ButtonVariant, string> = {
    primary: theme.tint,
    secondary: theme.surface,
    danger: theme.danger,
  };
  const textColors: Record<ButtonVariant, string> = {
    primary: '#fff',
    secondary: theme.text,
    danger: '#fff',
  };

  const isDisabled = disabled || loading;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: backgrounds[variant], opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColors[variant]} />
      ) : (
        <Text style={[styles.label, { color: textColors[variant] }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
