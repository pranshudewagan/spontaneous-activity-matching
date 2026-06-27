import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

export default function MyPlansScreen() {
  const router = useRouter();
  const theme = Colors.light;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.line }]}>
        <ThemedText type="title">My plans</ThemedText>
        <Pressable
          style={[styles.postBtn, { backgroundColor: theme.action }]}
          onPress={() => router.push('/host')}
          hitSlop={8}>
          <ThemedText type="label" style={styles.postBtnText}>+ Post</ThemedText>
        </Pressable>
      </View>

      {/* Empty state */}
      <View style={styles.inner}>
        <ThemedText type="body" themeColor="muted" style={styles.sub}>
          Your upcoming activities will appear here.
        </ThemedText>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  postBtn: {
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
  },
  postBtnText: { color: '#FFFFFF' },
  inner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.four,
  },
  sub: { textAlign: 'center' },
});
