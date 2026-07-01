import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const theme = useTheme();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  async function signIn() {
    const trimmed = email.trim();
    if (!trimmed || !password) return;
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: trimmed, password });
    setLoading(false);
    if (error) setError('Incorrect email or password.');
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: theme.bg }]}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.inner}
        >
          <ThemedText type="display" style={styles.heading}>Sign in</ThemedText>

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
            autoComplete="email"
            textContentType="emailAddress"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            returnKeyType="next"
          />

          <TextInput
            style={[styles.input, {
              backgroundColor: theme.surface,
              borderColor: theme.line,
              color: theme.ink,
            }]}
            placeholder="Password"
            placeholderTextColor={theme.muted}
            value={password}
            onChangeText={setPassword}
            autoComplete="password"
            textContentType="password"
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={signIn}
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
            onPress={signIn}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <ThemedText type="label" style={styles.buttonText}>Sign in</ThemedText>
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
  heading: { textAlign: 'center', marginBottom: Spacing.three },
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
