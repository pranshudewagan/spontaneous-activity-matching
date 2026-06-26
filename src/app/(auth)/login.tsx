import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: trimmed });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push({ pathname: '/(auth)/verify', params: { email: trimmed } });
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
            We'll send a one-time code to your email.
          </ThemedText>

          <TextInput
            style={[styles.input, {
              backgroundColor: theme.surface,
              borderColor: theme.line,
              color: theme.ink,
            }]}
            placeholder="you@example.com"
            placeholderTextColor={theme.muted}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
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
