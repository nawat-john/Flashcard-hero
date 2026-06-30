import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

type ListRowProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconColor?: string;
  iconEmoji?: string;
  title: string;
  subtitle?: string;
  rightText?: string;
  onPress?: () => void;
  onMorePress?: () => void;
};

export function ListRow({
  icon,
  iconColor,
  iconEmoji,
  title,
  subtitle,
  rightText,
  onPress,
  onMorePress,
}: ListRowProps) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {iconEmoji ? (
        <Text style={styles.emoji}>{iconEmoji}</Text>
      ) : (
        <MaterialIcons name={icon} size={26} color={iconColor ?? theme.tint} />
      )}
      <View style={styles.text}>
        <ThemedText type="defaultSemiBold" numberOfLines={1}>
          {title}
        </ThemedText>
        {subtitle ? (
          <ThemedText numberOfLines={1} style={[styles.subtitle, { color: theme.muted }]}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {rightText ? (
        <ThemedText style={[styles.rightText, { color: theme.muted }]}>{rightText}</ThemedText>
      ) : null}
      {onMorePress ? (
        <Pressable onPress={onMorePress} hitSlop={12} style={styles.more}>
          <MaterialIcons name="more-vert" size={22} color={theme.muted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  subtitle: {
    fontSize: 13,
  },
  rightText: {
    fontSize: 13,
  },
  more: {
    padding: Spacing.xs,
  },
  emoji: {
    fontSize: 22,
    width: 26,
    textAlign: 'center',
  },
});
