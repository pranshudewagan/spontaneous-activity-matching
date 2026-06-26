import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
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
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'email',
    });
    setLoading(false);
    if (error) setError(error.message);
    // on success, root _layout.tsx detects the new session and redirects to (app)
  }

  async function resend() {
    setResending(true);
    setError(null);
    setResent(false);
    await supabase.auth.signInWithOtp({ email });
    setResending(false);
    setResent(true);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.inner}>
        <ThemedText type="title" style={styles.heading}>Enter code</ThemedText>
        <ThemedText type="small" style={styles.sub}>
          Sent to {email}
        </ThemedText>

        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          placeholder="6-digit code"
          placeholderTextColor={theme.textSecondary}
          value={code}
          onChangeText={setCode}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          onSubmitEditing={verify}
          returnKeyType="done"
        />

        {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={verify}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <ThemedText type="small" style={styles.buttonText}>Verify</ThemedText>
          }
        </Pressable>

        <Pressable onPress={resend} disabled={resending} style={styles.resendRow}>
          {resending
            ? <ActivityIndicator size="small" />
            : <ThemedText type="small" style={styles.resendText}>
                {resent ? 'Code resent!' : 'Resend code'}
              </ThemedText>
          }
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  heading: { textAlign: 'center' },
  sub: { textAlign: 'center', opacity: 0.6 },
  input: {
    borderWidth: 1,
    borderColor: '#E6E4EA',
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    letterSpacing: 8,
    textAlign: 'center',
  },
  error: { color: '#D14545', textAlign: 'center' },
  button: {
    backgroundColor: '#FB8B24',
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  pressed: { opacity: 0.8 },
  buttonText: { color: '#fff' },
  resendRow: { alignItems: 'center' },
  resendText: { color: '#3CAEA3' },
});
