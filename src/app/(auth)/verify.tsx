import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function VerifyScreen() {
  const theme = useTheme();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function verify() {
    if (code.length < 6) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    setLoading(false);
    if (error) setError(error.message);
    // on success root _layout detects new session and redirects to (app)
  }

  async function resend() {
    setResending(true);
    setError(null);
    setResent(false);
    const { error } = await supabase.auth.signInWithOtp({ email });
    setResending(false);
    if (error) setError(error.message);
    else setResent(true);
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inner}
        >
          <ThemedText type="display" style={styles.heading}>Enter code</ThemedText>
          <ThemedText type="caption" themeColor="muted" style={styles.sub}>
            Sent to {email}
          </ThemedText>

          <TextInput
            style={[styles.input, {
              backgroundColor: theme.surface,
              borderColor: theme.line,
              color: theme.ink,
            }]}
            placeholder="000000"
            placeholderTextColor={theme.muted}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
            onSubmitEditing={verify}
            returnKeyType="done"
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
            onPress={verify}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <ThemedText type="label" style={styles.buttonText}>Verify</ThemedText>
            }
          </Pressable>

          <Pressable onPress={resend} disabled={resending} style={styles.resendRow}>
            {resending
              ? <ActivityIndicator size="small" color={theme.accent} />
              : <ThemedText type="caption" style={{ color: theme.accent }}>
                  {resent ? 'Code resent' : 'Resend code'}
                </ThemedText>
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
    height: 48,
    fontSize: 20,
    letterSpacing: 10,
    textAlign: 'center',
  },
  error:     { textAlign: 'center' },
  button: {
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.one,
  },
  buttonText: { color: '#fff' },
  resendRow:  { alignItems: 'center', paddingVertical: Spacing.two },
});
