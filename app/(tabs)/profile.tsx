import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FormModal } from '@/components/form-modal';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/lib/auth';
import { getProfile, updateDisplayName } from '@/lib/profiles';

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

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
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.avatar, { backgroundColor: theme.surface }]}>
        <MaterialIcons name="person" size={48} color={theme.muted} />
      </View>

      <ThemedText type="subtitle">{displayName ?? 'User'}</ThemedText>
      <ThemedText style={[styles.email, { color: theme.muted }]}>{user?.email}</ThemedText>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
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
  email: {
    marginBottom: Spacing.lg,
  },
  actions: {
    alignSelf: 'stretch',
    gap: Spacing.md,
  },
});
