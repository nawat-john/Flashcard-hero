import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useAppTheme } from '@/hooks/use-app-theme';

export type FormField = {
  key: string;
  label: string;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  initialValue?: string;
};

type FormModalProps = {
  visible: boolean;
  title: string;
  fields: FormField[];
  submitLabel?: string;
  onSubmit: (values: Record<string, string>) => void | Promise<void>;
  onClose: () => void;
};

function buildInitialValues(fields: FormField[]): Record<string, string> {
  return Object.fromEntries(fields.map((field) => [field.key, field.initialValue ?? '']));
}

export function FormModal({
  visible,
  title,
  fields,
  submitLabel = 'บันทึก',
  onSubmit,
  onClose,
}: FormModalProps) {
  const theme = useAppTheme();
  const [values, setValues] = useState<Record<string, string>>(() => buildInitialValues(fields));
  const [submitting, setSubmitting] = useState(false);

  // Reset the form to its initial values each time the modal opens.
  useEffect(() => {
    if (visible) {
      setValues(buildInitialValues(fields));
      setSubmitting(false);
    }
    // `fields` is rebuilt on every render by callers, so key off `visible` only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const missingRequired = fields.some(
    (field) => field.required && (values[field.key] ?? '').trim().length === 0
  );

  async function handleSubmit() {
    if (missingRequired || submitting) return;
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <ThemedText type="subtitle">{title}</ThemedText>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.fields}>
            {fields.map((field) => (
              <View key={field.key} style={styles.field}>
                <ThemedText style={[styles.fieldLabel, { color: theme.muted }]}>
                  {field.label}
                </ThemedText>
                <TextInput
                  value={values[field.key]}
                  onChangeText={(text) => setValues((prev) => ({ ...prev, [field.key]: text }))}
                  placeholder={field.placeholder}
                  placeholderTextColor={theme.muted}
                  multiline={field.multiline}
                  autoFocus={fields[0]?.key === field.key}
                  style={[
                    styles.input,
                    field.multiline && styles.inputMultiline,
                    {
                      color: theme.text,
                      backgroundColor: theme.surface,
                      borderColor: theme.border,
                    },
                  ]}
                />
              </View>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            <Button label="ยกเลิก" variant="secondary" onPress={onClose} style={styles.action} />
            <Button
              label={submitLabel}
              onPress={handleSubmit}
              disabled={missingRequired}
              loading={submitting}
              style={styles.action}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    maxHeight: '80%',
  },
  fields: {
    flexGrow: 0,
  },
  field: {
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  fieldLabel: {
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  action: {
    flex: 1,
  },
});
