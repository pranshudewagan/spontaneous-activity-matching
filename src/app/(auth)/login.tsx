import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput } from 'react-native';
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
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.inner}>
        <ThemedText type="title" style={styles.heading}>Sign in</ThemedText>
        <ThemedText type="small" style={styles.sub}>
          We'll send a code to your email.
        </ThemedText>

        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          placeholder="you@example.com"
          placeholderTextColor={theme.textSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          onSubmitEditing={sendCode}
          returnKeyType="send"
        />

        {error && <ThemedText type="small" style={styles.error}>{error}</ThemedText>}

        <Pressable
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
          onPress={sendCode}
          disabled={loading}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <ThemedText type="small" style={styles.buttonText}>Send code</ThemedText>
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
});
