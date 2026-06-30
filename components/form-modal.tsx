import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  type?: 'text' | 'color' | 'select';
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  initialValue?: string;
  maxLength?: number;
  options?: { value: string; label: string }[];
};

const PRESET_COLORS: { label: string; value: string }[] = [
  { label: 'Default', value: '' },
  { label: 'Red', value: '#e74c3c' },
  { label: 'Orange', value: '#e67e22' },
  { label: 'Yellow', value: '#f1c40f' },
  { label: 'Green', value: '#27ae60' },
  { label: 'Teal', value: '#1abc9c' },
  { label: 'Blue', value: '#3498db' },
  { label: 'Purple', value: '#9b59b6' },
  { label: 'Pink', value: '#e91e63' },
  { label: 'Brown', value: '#795548' },
];

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
  submitLabel = 'Save',
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
    (field) =>
      field.required &&
      (!field.type || field.type === 'text') &&
      (values[field.key] ?? '').trim().length === 0
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

  function setValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
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
            {fields.map((field) => {
              const fieldType = field.type ?? 'text';

              if (fieldType === 'color') {
                const current = values[field.key] ?? '';
                return (
                  <View key={field.key} style={styles.field}>
                    <ThemedText style={[styles.fieldLabel, { color: theme.muted }]}>
                      {field.label}
                    </ThemedText>
                    <View style={styles.swatchRow}>
                      {PRESET_COLORS.map((c) => {
                        const selected = current === c.value;
                        const bg = c.value || theme.surface;
                        return (
                          <Pressable
                            key={c.value || 'default'}
                            onPress={() => setValue(field.key, c.value)}
                            style={[
                              styles.swatch,
                              { backgroundColor: bg, borderColor: selected ? theme.text : theme.border },
                              selected && styles.swatchSelected,
                            ]}
                          >
                            {selected && (
                              <Text style={[styles.swatchCheck, { color: c.value ? '#fff' : theme.text }]}>
                                ✓
                              </Text>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              }

              if (fieldType === 'select') {
                const current = values[field.key] ?? '';
                return (
                  <View key={field.key} style={styles.field}>
                    <ThemedText style={[styles.fieldLabel, { color: theme.muted }]}>
                      {field.label}
                    </ThemedText>
                    <View style={styles.selectRow}>
                      {(field.options ?? []).map((opt) => {
                        const active = current === opt.value;
                        return (
                          <Pressable
                            key={opt.value}
                            onPress={() => setValue(field.key, opt.value)}
                            style={[
                              styles.selectChip,
                              {
                                backgroundColor: active ? theme.tint : theme.surface,
                                borderColor: active ? theme.tint : theme.border,
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.selectChipLabel,
                                { color: active ? '#fff' : theme.text },
                              ]}
                            >
                              {opt.label}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                );
              }

              // Default: text input
              return (
                <View key={field.key} style={styles.field}>
                  <ThemedText style={[styles.fieldLabel, { color: theme.muted }]}>
                    {field.label}
                  </ThemedText>
                  <TextInput
                    value={values[field.key]}
                    onChangeText={(text) => setValue(field.key, text)}
                    placeholder={field.placeholder}
                    placeholderTextColor={theme.muted}
                    multiline={field.multiline}
                    maxLength={field.maxLength}
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
              );
            })}
          </ScrollView>
          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.action} />
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
    maxHeight: '85%',
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
  swatchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: {
    borderWidth: 3,
  },
  swatchCheck: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  selectRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  selectChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  selectChipLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  action: {
    flex: 1,
  },
});
