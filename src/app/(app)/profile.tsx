import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { User } from '@supabase/supabase-js';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function ProfileScreen() {
  const theme = useTheme();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user));
  }, []);

  const initial = user?.email?.[0].toUpperCase() ?? '?';

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Avatar + identity */}
        <View style={styles.header}>
          <View style={[styles.avatar, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="title" themeColor="muted">{initial}</ThemedText>
          </View>
          <ThemedText type="title" themeColor="muted">Your name</ThemedText>
          <ThemedText type="caption" themeColor="muted">— · —</ThemedText>
        </View>

        {/* Bio */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <ThemedText type="caption" themeColor="muted" style={styles.cardLabel}>Bio</ThemedText>
          <ThemedText type="body" themeColor="muted">Tell others what you're into...</ThemedText>
        </View>

        {/* Interests */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <ThemedText type="caption" themeColor="muted" style={styles.cardLabel}>Interests</ThemedText>
          <ThemedText type="body" themeColor="muted">No interests added yet</ThemedText>
        </View>

        {/* Activities done — private to the owner */}
        <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
          <ThemedText type="caption" themeColor="muted" style={styles.cardLabel}>Activities done</ThemedText>
          <ThemedText type="title">0</ThemedText>
        </View>

        {/* Set up profile CTA */}
        <Pressable
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: theme.action, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <ThemedText type="label" style={styles.buttonText}>Set up profile</ThemedText>
        </Pressable>

        {/* Sign out */}
        <Pressable onPress={() => supabase.auth.signOut()} style={styles.signOut}>
          <ThemedText type="label" themeColor="muted">Sign out</ThemedText>
        </Pressable>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: Spacing.six },
  header: {
    alignItems: 'center',
    paddingTop: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.two,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  card: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    borderRadius: 16,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  cardLabel: { marginBottom: Spacing.half },
  button: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { color: '#fff' },
  signOut: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    marginTop: Spacing.one,
  },
});
