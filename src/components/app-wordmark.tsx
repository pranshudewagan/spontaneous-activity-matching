import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, DisplayFont } from '@/constants/theme';

export function AppWordmark() {
  const theme = Colors.light;
  return (
    <View style={styles.row}>
      <Image
        source={require('../../assets/images/icon.png')}
        style={styles.logo}
        contentFit="contain"
      />
      <ThemedText style={[styles.name, { color: theme.ink }]}>Facilitator</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 30, height: 30 },
  name: { fontFamily: DisplayFont, fontSize: 20 },
});
