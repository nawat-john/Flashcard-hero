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
        <ThemedText type="subtitle">ยังไม่ได้เชื่อม Supabase</ThemedText>
        <ThemedText style={[styles.setup, { color: theme.muted }]}>
          ใส่ค่า EXPO_PUBLIC_SUPABASE_URL และ EXPO_PUBLIC_SUPABASE_ANON_KEY ในไฟล์ `.env`{'\n'}
          แล้วรัน `npm start` ใหม่ (ดูขั้นตอนเต็มใน `supabase/schema.sql`)
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
            'ยืนยันอีเมล',
            'เราส่งลิงก์ยืนยันไปที่อีเมลของคุณแล้ว ยืนยันก่อนแล้วค่อยเข้าสู่ระบบ'
          );
          setMode('signIn');
        }
      }
    } catch (error) {
      Alert.alert('เกิดข้อผิดพลาด', error instanceof Error ? error.message : 'ลองอีกครั้ง');
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
          {mode === 'signIn' ? 'เข้าสู่ระบบเพื่อใช้คลังของคุณ' : 'สร้างบัญชีใหม่'}
        </ThemedText>

        {mode === 'signUp' ? (
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="ชื่อที่แสดง"
            placeholderTextColor={theme.muted}
            style={inputStyle}
          />
        ) : null}
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="อีเมล"
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
          placeholder="รหัสผ่าน (อย่างน้อย 6 ตัว)"
          placeholderTextColor={theme.muted}
          secureTextEntry
          style={inputStyle}
        />

        <Button
          label={mode === 'signIn' ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          onPress={handleSubmit}
          disabled={!canSubmit}
          loading={submitting}
          style={styles.submit}
        />
        <Button
          label={mode === 'signIn' ? 'ยังไม่มีบัญชี? สมัครสมาชิก' : 'มีบัญชีแล้ว? เข้าสู่ระบบ'}
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
