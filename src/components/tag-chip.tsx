import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { TAGS } from '@/lib/tags';

type Props = {
  slug: string;
  selected?: boolean;    // undefined = display-only (always colored)
  onPress?: () => void;
  disabled?: boolean;
};

export function TagChip({ slug, selected, onPress, disabled }: Props) {
  const theme = Colors.light;
  const tag   = TAGS.find(t => t.slug === slug);
  if (!tag) return null;

  const colored = onPress === undefined || selected;
  const bg      = colored ? tag.color + '25' : theme.surface;
  const border  = colored ? tag.color + '60' : theme.line;
  const color   = colored ? tag.color        : theme.muted;

  return (
    <Pressable
      style={[styles.chip, { backgroundColor: bg, borderColor: border }, disabled && styles.dimmed]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={tag.icon as any} size={12} color={color} />
      <ThemedText type="caption" style={{ color, fontWeight: '600', marginLeft: 4 }}>
        {tag.label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },
  dimmed: {
    opacity: 0.4,
  },
});
