import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FormModal } from '@/components/form-modal';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/lib/auth';
import { getProfile, updateDisplayName } from '@/lib/profiles';
import {
  getThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from '@/lib/theme-preference';
import { useEffect } from 'react';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: 'brightness-auto' | 'light-mode' | 'dark-mode' }[] = [
  { value: 'system', label: 'System', icon: 'brightness-auto' },
  { value: 'light', label: 'Light', icon: 'light-mode' },
  { value: 'dark', label: 'Dark', icon: 'dark-mode' },
];

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [themePref, setThemePref] = useState<ThemePreference>(getThemePreference());

  useEffect(() => {
    return subscribeTheme(setThemePref);
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const profile = await getProfile(user.id);
    setDisplayName(profile?.displayName ?? null);
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function confirmSignOut() {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  }

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
    >
      <View style={[styles.avatar, { backgroundColor: theme.surface }]}>
        <MaterialIcons name="person" size={48} color={theme.muted} />
      </View>

      <ThemedText type="subtitle">{displayName ?? 'User'}</ThemedText>
      <ThemedText style={[styles.email, { color: theme.muted }]}>{user?.email}</ThemedText>

      {/* Theme picker */}
      <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
          Appearance
        </ThemedText>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((opt) => {
            const active = themePref === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setThemePreference(opt.value)}
                style={[
                  styles.themeBtn,
                  {
                    backgroundColor: active ? theme.tint : theme.surface,
                    borderColor: active ? theme.tint : theme.border,
                  },
                ]}
              >
                <MaterialIcons
                  name={opt.icon}
                  size={20}
                  color={active ? '#fff' : theme.muted}
                />
                <ThemedText
                  style={[styles.themeBtnLabel, { color: active ? '#fff' : theme.muted }]}
                >
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.actions}>
        <Button label="Edit display name" variant="secondary" onPress={() => setEditing(true)} />
        <Button label="Sign out" variant="danger" onPress={confirmSignOut} />
      </View>

      <FormModal
        visible={editing}
        title="Display name"
        fields={[
          {
            key: 'displayName',
            label: 'Display name',
            required: true,
            initialValue: displayName ?? '',
            maxLength: 50,
          },
        ]}
        onSubmit={async (values) => {
          if (user) {
            await updateDisplayName(user.id, values.displayName);
          }
          setEditing(false);
          load();
        }}
        onClose={() => setEditing(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  email: {
    marginBottom: Spacing.lg,
  },
  section: {
    alignSelf: 'stretch',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 14,
  },
  themeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  themeBtn: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  themeBtnLabel: {
    fontSize: 12,
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.md,
  },
});
