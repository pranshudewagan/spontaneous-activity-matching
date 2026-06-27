import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

function toE164(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (raw.trim().startsWith('+')) return '+' + digits;
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  return '+' + digits;
}

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const formatted = toE164(phone.trim());
    if (formatted.length < 8) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ phone: formatted });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push({ pathname: '/(auth)/verify', params: { phone: formatted } });
    }
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inner}
        >
          <ThemedText type="display" style={styles.heading}>Sign in</ThemedText>
          <ThemedText type="caption" themeColor="muted" style={styles.sub}>
            We'll text a 6-digit code to your number.
          </ThemedText>

          <TextInput
            style={[styles.input, {
              backgroundColor: theme.surface,
              borderColor: theme.line,
              color: theme.ink,
            }]}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor={theme.muted}
            value={phone}
            onChangeText={setPhone}
            autoComplete="tel"
            textContentType="telephoneNumber"
            keyboardType="phone-pad"
            autoFocus
            onSubmitEditing={sendCode}
            returnKeyType="send"
          />

          {error && (
            <ThemedText type="caption" style={[styles.error, { color: theme.danger }]}>
              {error}
            </ThemedText>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: theme.action, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={sendCode}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <ThemedText type="label" style={styles.buttonText}>Send code</ThemedText>
            }
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe:      { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.two,
  },
  heading: { textAlign: 'center', marginBottom: Spacing.one },
  sub:     { textAlign: 'center', marginBottom: Spacing.three },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    height: 48,
    fontSize: 16,
  },
  error:  { textAlign: 'center' },
  button: {
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  buttonText: { color: '#fff' },
});
