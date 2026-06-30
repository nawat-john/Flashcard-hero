import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Constants from 'expo-constants';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { FormModal } from '@/components/form-modal';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/lib/auth';
import { getProfile, sendPasswordReset, updateDisplayName } from '@/lib/profiles';
import {
  clearMirror,
  ensureLoaded,
  hydrate,
  mPendingCount,
  mTotalCards,
  mTotalDecks,
  mTotalReviews,
} from '@/lib/store';
import {
  getStudyPrefs,
  loadStudyPrefs,
  setStudyPrefs,
  subscribeStudyPrefs,
  type StudyPrefs,
} from '@/lib/study-preference';
import {
  getThemePreference,
  setThemePreference,
  subscribeTheme,
  type ThemePreference,
} from '@/lib/theme-preference';

const THEME_OPTIONS: {
  value: ThemePreference;
  label: string;
  icon: 'brightness-auto' | 'light-mode' | 'dark-mode';
}[] = [
  { value: 'system', label: 'System', icon: 'brightness-auto' },
  { value: 'light', label: 'Light', icon: 'light-mode' },
  { value: 'dark', label: 'Dark', icon: 'dark-mode' },
];

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

function getInitials(name: string | null): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return (parts[0][0] ?? '?').toUpperCase();
  return ((parts[0][0] ?? '') + (parts[parts.length - 1][0] ?? '')).toUpperCase();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

type SectionProps = { title: string; children: React.ReactNode };
function Section({ title, children }: SectionProps) {
  const theme = useAppTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <ThemedText style={[styles.sectionTitle, { color: theme.muted }]}>{title}</ThemedText>
      {children}
    </View>
  );
}

type StatTileProps = { value: number | string; label: string };
function StatTile({ value, label }: StatTileProps) {
  const theme = useAppTheme();
  return (
    <View style={[styles.statTile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <ThemedText type="subtitle" style={styles.statValue}>
        {value}
      </ThemedText>
      <ThemedText style={[styles.statLabel, { color: theme.muted }]}>{label}</ThemedText>
    </View>
  );
}

type ChipRowProps<T extends string> = {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
};
function ChipRow<T extends string>({ options, value, onChange }: ChipRowProps<T>) {
  const theme = useAppTheme();
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? theme.tint : theme.surface,
                borderColor: active ? theme.tint : theme.border,
              },
            ]}
          >
            <ThemedText style={[styles.chipLabel, { color: active ? '#fff' : theme.muted }]}>
              {opt.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

type ActionRowProps = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  label: string;
  onPress: () => void;
  danger?: boolean;
  hint?: string;
};
function ActionRow({ icon, label, onPress, danger, hint }: ActionRowProps) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.6 : 1 }]}
    >
      <MaterialIcons name={icon} size={20} color={danger ? theme.danger : theme.muted} />
      <View style={styles.actionRowText}>
        <ThemedText style={danger ? { color: theme.danger } : undefined}>{label}</ThemedText>
        {hint ? (
          <ThemedText style={[styles.actionHint, { color: theme.muted }]}>{hint}</ThemedText>
        ) : null}
      </View>
      <MaterialIcons name="chevron-right" size={20} color={theme.border} />
    </Pressable>
  );
}

type InfoRowProps = { label: string; value: string };
function InfoRow({ label, value }: InfoRowProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.infoRow}>
      <ThemedText style={{ color: theme.muted }}>{label}</ThemedText>
      <ThemedText style={[styles.infoValue, { color: theme.muted }]}>{value}</ThemedText>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ProfileScreen() {
  const theme = useAppTheme();
  const { user, signOut } = useAuth();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [themePref, setThemePref] = useState<ThemePreference>(getThemePreference());
  const [studyPrefs, setStudyPrefsState] = useState<StudyPrefs>(getStudyPrefs());
  const [totalDecks, setTotalDecks] = useState(0);
  const [totalCards, setTotalCards] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    return subscribeTheme(setThemePref);
  }, []);

  useEffect(() => {
    loadStudyPrefs().then(setStudyPrefsState);
    return subscribeStudyPrefs(setStudyPrefsState);
  }, []);

  const loadStats = useCallback(async () => {
    await ensureLoaded();
    setTotalDecks(mTotalDecks());
    setTotalCards(mTotalCards());
    setTotalReviews(mTotalReviews());
    setPending(mPendingCount());
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    const profile = await getProfile(user.id);
    setDisplayName(profile?.displayName ?? null);
    await loadStats();
  }, [user, loadStats]);

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

  async function handleChangePassword() {
    if (!user?.email) return;
    Alert.alert(
      'Reset password',
      `A password reset link will be sent to ${user.email}. Check your inbox.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send email',
          onPress: async () => {
            try {
              await sendPasswordReset(user.email!);
              Alert.alert('Email sent', 'Check your inbox for a password reset link.');
            } catch (e) {
              Alert.alert('Error', e instanceof Error ? e.message : 'Please try again.');
            }
          },
        },
      ]
    );
  }

  async function handleSyncNow() {
    setSyncing(true);
    try {
      await hydrate();
      await loadStats();
    } catch {
      Alert.alert('Sync failed', 'Could not reach the server. Try again later.');
    } finally {
      setSyncing(false);
    }
  }

  function handleClearCache() {
    const pendingCount = mPendingCount();
    const message =
      pendingCount > 0
        ? `You have ${pendingCount} pending change${pendingCount !== 1 ? 's' : ''} that haven't synced yet. They will be lost. Continue?`
        : 'This will delete the local copy of your data and re-download it from the server.';
    Alert.alert('Clear offline cache?', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          setSyncing(true);
          try {
            await clearMirror();
            await hydrate();
            await loadStats();
          } catch {
            Alert.alert('Error', 'Could not re-sync data. Please try again.');
          } finally {
            setSyncing(false);
          }
        },
      },
    ]);
  }

  const initials = getInitials(displayName);

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={[styles.container, { backgroundColor: theme.background }]}
    >
      {/* Header */}
      <View style={[styles.avatar, { backgroundColor: theme.tint }]}>
        <ThemedText style={styles.avatarInitials}>{initials}</ThemedText>
      </View>
      <ThemedText type="subtitle">{displayName ?? 'User'}</ThemedText>
      <ThemedText style={[styles.email, { color: theme.muted }]}>{user?.email}</ThemedText>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatTile value={totalDecks} label="Decks" />
        <StatTile value={totalCards} label="Cards" />
        <StatTile value={totalReviews} label="Reviews" />
      </View>

      {/* Appearance */}
      <Section title="APPEARANCE">
        <View style={styles.prefRow}>
          <ThemedText style={styles.prefLabel}>Theme</ThemedText>
          <View style={styles.chipRow}>
            {THEME_OPTIONS.map((opt) => {
              const active = themePref === opt.value;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setThemePreference(opt.value)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? theme.tint : theme.surface,
                      borderColor: active ? theme.tint : theme.border,
                    },
                  ]}
                >
                  <MaterialIcons name={opt.icon} size={16} color={active ? '#fff' : theme.muted} />
                  <ThemedText
                    style={[styles.chipLabel, { color: active ? '#fff' : theme.muted }]}
                  >
                    {opt.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <View style={styles.prefRow}>
          <ThemedText style={styles.prefLabel}>Card size</ThemedText>
          <ChipRow
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'large', label: 'Large' },
            ]}
            value={studyPrefs.cardFontSize}
            onChange={(v) => setStudyPrefs({ cardFontSize: v })}
          />
        </View>
      </Section>

      {/* Study defaults */}
      <Section title="STUDY DEFAULTS">
        <View style={styles.prefRow}>
          <ThemedText style={styles.prefLabel}>Default order</ThemedText>
          <ChipRow
            options={[
              { value: 'sequential', label: 'In order' },
              { value: 'random', label: 'Random' },
            ]}
            value={studyPrefs.defaultStudyOrder}
            onChange={(v) => setStudyPrefs({ defaultStudyOrder: v })}
          />
        </View>
      </Section>

      {/* Account */}
      <Section title="ACCOUNT">
        <ActionRow
          icon="edit"
          label="Edit display name"
          onPress={() => setEditingName(true)}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <ActionRow
          icon="lock-reset"
          label="Change password"
          hint="Sends a reset link to your email"
          onPress={handleChangePassword}
        />
      </Section>

      {/* Data & Sync */}
      <Section title="DATA & SYNC">
        {pending > 0 ? (
          <ThemedText style={[styles.pendingHint, { color: theme.muted }]}>
            {pending} change{pending !== 1 ? 's' : ''} pending sync
          </ThemedText>
        ) : null}
        <ActionRow
          icon="sync"
          label={syncing ? 'Syncing…' : 'Sync now'}
          hint="Pull latest data from the server"
          onPress={handleSyncNow}
        />
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <ActionRow
          icon="delete-sweep"
          label="Clear offline cache"
          hint="Re-download all data from server"
          onPress={handleClearCache}
          danger
        />
      </Section>

      {/* About */}
      <Section title="ABOUT">
        <InfoRow label="Version" value={APP_VERSION} />
      </Section>

      {/* Sign out */}
      <View style={styles.signOut}>
        <Button label="Sign out" variant="danger" onPress={confirmSignOut} />
      </View>

      {/* Modals */}
      <FormModal
        visible={editingName}
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
          if (user) await updateDisplayName(user.id, values.displayName);
          setEditingName(false);
          load();
        }}
        onClose={() => setEditingName(false)}
      />
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  avatarInitials: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
  },
  email: {
    marginBottom: Spacing.md,
  },
  // stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignSelf: 'stretch',
    marginBottom: Spacing.md,
  },
  statTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    borderWidth: 1,
    gap: 2,
  },
  statValue: {
    fontSize: 22,
  },
  statLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // section
  section: {
    alignSelf: 'stretch',
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  divider: {
    height: 1,
    marginHorizontal: -Spacing.lg,
  },
  // pref row
  prefRow: {
    gap: Spacing.sm,
  },
  prefLabel: {
    fontSize: 15,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  // action row
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  actionRowText: {
    flex: 1,
    gap: 1,
  },
  actionHint: {
    fontSize: 12,
  },
  // info row
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoValue: {
    fontSize: 14,
  },
  // pending
  pendingHint: {
    fontSize: 13,
  },
  // sign out
  signOut: {
    alignSelf: 'stretch',
    marginTop: Spacing.sm,
  },
});
