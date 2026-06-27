import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';
import { useAuth } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase';

type Mode = 'signIn' | 'signUp';

export default function LoginScreen() {
  const theme = useAppTheme();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<Mode>('signIn');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!isSupabaseConfigured) {
    return (
      <View style={[styles.center, { backgroundColor: theme.background }]}>
        <ThemedText type="title" style={styles.brand}>
          Flashcard Hero
        </ThemedText>
        <ThemedText type="subtitle">Supabase not connected</ThemedText>
        <ThemedText style={[styles.setup, { color: theme.muted }]}>
          Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in `.env`{'\n'}
          then restart `npm start` (full steps in `supabase/schema.sql`)
        </ThemedText>
      </View>
    );
  }

  const canSubmit =
    email.trim().length > 0 &&
    password.length >= 6 &&
    (mode === 'signIn' || displayName.trim().length > 0);

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else {
        const { needsConfirmation } = await signUp(email, password, displayName);
        if (needsConfirmation) {
          Alert.alert(
            'Confirm your email',
            'We sent a confirmation link to your email. Confirm it before signing in.'
          );
          setMode('signIn');
        }
      }
    } catch (error) {
      Alert.alert(
        'Something went wrong',
        error instanceof Error ? error.message : 'Please try again'
      );
    } finally {
      setSubmitting(false);
    }
  }

  const inputStyle = [
    styles.input,
    { color: theme.text, backgroundColor: theme.card, borderColor: theme.border },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <ThemedText type="title" style={styles.brand}>
          Flashcard Hero
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: theme.muted }]}>
          {mode === 'signIn' ? 'Sign in to access your library' : 'Create a new account'}
        </ThemedText>

        {mode === 'signUp' ? (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor={theme.muted}
            style={inputStyle}
          />
        ) : null}
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.muted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          inputMode="email"
          style={inputStyle}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password (at least 6 characters)"
          placeholderTextColor={theme.muted}
          secureTextEntry
          style={inputStyle}
        />

        <Button
          label={mode === 'signIn' ? 'Sign in' : 'Sign up'}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
          style={styles.submit}
        />
        <Button
          label={
            mode === 'signIn'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'
          }
          variant="secondary"
          onPress={() => setMode((m) => (m === 'signIn' ? 'signUp' : 'signIn'))}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  brand: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  setup: {
    textAlign: 'center',
    lineHeight: 22,
    marginTop: Spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  submit: {
    marginTop: Spacing.sm,
  },
});
