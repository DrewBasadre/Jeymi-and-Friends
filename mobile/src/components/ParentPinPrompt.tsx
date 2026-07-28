import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ShieldCheck, X } from 'lucide-react-native';
import {
  getParentPinRecord,
  setParentPin,
  verifyParentPin,
} from '@/data/parentRepository';
import { isValidParentPin } from '@/domain/parentPin';
import { colors, radius, spacing } from '@/theme/tokens';
import { IconButton, PrimaryButton } from './ui';

export function ParentPinPrompt({
  studentId,
  visible,
  purpose,
  onAuthorized,
  onCancel,
}: {
  studentId: string;
  visible: boolean;
  purpose: string;
  onAuthorized(): void;
  onCancel(): void;
}) {
  const [mode, setMode] = useState<'loading' | 'create' | 'verify'>(
    'loading',
  );
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMode('loading');
    setPin('');
    setConfirmation('');
    setError('');
    void getParentPinRecord(studentId).then((record) =>
      setMode(record ? 'verify' : 'create'),
    );
  }, [studentId, visible]);

  async function submit() {
    setError('');
    if (!isValidParentPin(pin)) {
      setError('Use a 4 to 8 digit PIN.');
      return;
    }
    if (mode === 'create' && pin !== confirmation) {
      setError('The PIN entries do not match.');
      return;
    }
    setSubmitting(true);
    try {
      if (mode === 'create') {
        await setParentPin(studentId, pin);
      } else if (!(await verifyParentPin(studentId, pin))) {
        setError('That parent PIN is not correct.');
        return;
      }
      setPin('');
      setConfirmation('');
      onAuthorized();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <View style={styles.heading}>
            <View style={styles.icon}>
              <ShieldCheck size={25} color={colors.emerald} />
            </View>
            <View style={styles.flex}>
              <Text style={styles.title}>
                {mode === 'create' ? 'Create parent PIN' : 'Parent check'}
              </Text>
              <Text style={styles.body}>{purpose}</Text>
            </View>
            <IconButton icon={X} label="Close" onPress={onCancel} />
          </View>
          {mode === 'loading' ? (
            <Text style={styles.body}>Checking this device...</Text>
          ) : (
            <>
              <TextInput
                accessibilityLabel="Parent PIN"
                autoFocus
                keyboardType="number-pad"
                maxLength={8}
                onChangeText={(value) => {
                  setPin(value.replace(/\D/g, ''));
                  setError('');
                }}
                placeholder={
                  mode === 'create' ? 'Choose 4 to 8 digits' : 'Enter PIN'
                }
                placeholderTextColor={colors.inkMuted}
                secureTextEntry
                style={styles.input}
                value={pin}
              />
              {mode === 'create' ? (
                <TextInput
                  accessibilityLabel="Confirm parent PIN"
                  keyboardType="number-pad"
                  maxLength={8}
                  onChangeText={(value) => {
                    setConfirmation(value.replace(/\D/g, ''));
                    setError('');
                  }}
                  placeholder="Confirm PIN"
                  placeholderTextColor={colors.inkMuted}
                  secureTextEntry
                  style={styles.input}
                  value={confirmation}
                />
              ) : null}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <PrimaryButton
                disabled={
                  !isValidParentPin(pin) ||
                  (mode === 'create' && confirmation.length < 4)
                }
                label={
                  mode === 'create' ? 'Set PIN and continue' : 'Continue'
                }
                loading={submitting}
                onPress={() => void submit()}
              />
              <Pressable onPress={onCancel} style={styles.cancel}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(17, 24, 39, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    gap: spacing.lg,
    maxWidth: 460,
    padding: spacing.xl,
    width: '100%',
  },
  heading: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: spacing.md,
  },
  icon: {
    alignItems: 'center',
    backgroundColor: colors.emeraldTint,
    borderRadius: radius.sm,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  flex: { flex: 1, gap: spacing.xs },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  body: { color: colors.inkMuted, fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.outline,
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 18,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
  },
  error: { color: colors.danger, fontSize: 14, fontWeight: '700' },
  cancel: { alignItems: 'center', minHeight: 40, justifyContent: 'center' },
  cancelText: { color: colors.inkMuted, fontSize: 14, fontWeight: '800' },
});
