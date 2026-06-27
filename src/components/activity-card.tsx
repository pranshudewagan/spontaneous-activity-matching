import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { tagColor } from '@/lib/tags';

export type ActivityCardData = {
  id: string;
  title: string;
  start_time: string;
  time_flexible: boolean;
  max_participants: number;
  accepted_count: number;
  distance_m: number;
  tags: string[];
};

type Props = {
  activity: ActivityCardData;
  onPress?: () => void;
};

function formatTime(iso: string, flexible: boolean): string {
  const date = new Date(iso);
  const now  = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  let day: string;
  if (date.toDateString() === now.toDateString())           day = 'Today';
  else if (date.toDateString() === tomorrow.toDateString()) day = 'Tomorrow';
  else day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return `${day} · ${time}${flexible ? ' (flexible)' : ''}`;
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return miles < 0.1 ? 'Nearby' : `~${miles.toFixed(1)} mi away`;
}

export function ActivityCard({ activity, onPress }: Props) {
  const theme       = Colors.light;
  const accentColor = tagColor(activity.tags[0] ?? '');
  const going       = activity.accepted_count + 1;
  const total       = activity.max_participants;

  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}
      onPress={onPress}>

      {/* Square thumbnail placeholder */}
      <View style={[styles.swatch, { backgroundColor: accentColor + '26' }]}>
        <View style={[styles.swatchDot, { backgroundColor: accentColor }]} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <ThemedText type="label" style={[styles.title, { color: theme.ink }]} numberOfLines={1}>
          {activity.title}
        </ThemedText>
        <ThemedText type="caption" style={[styles.time, { color: theme.action }]} numberOfLines={1}>
          {formatTime(activity.start_time, activity.time_flexible)}
        </ThemedText>
        <ThemedText type="caption" style={[styles.distance, { color: theme.muted }]}>
          {formatDistance(activity.distance_m)}
        </ThemedText>
        <ThemedText type="caption" style={[styles.capacity, { color: theme.accent }]}>
          {going} / {total} going
        </ThemedText>
      </View>

      {/* Chevron */}
      <ThemedText style={[styles.chevron, { color: theme.muted }]}>›</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: Spacing.two,
    padding: Spacing.two,
  },

  swatch: {
    width: 76,
    height: 76,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  swatchDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },

  content: {
    flex: 1,
    paddingHorizontal: Spacing.two + 2,
    gap: 2,
  },
  title:    { fontSize: 15, fontWeight: '600' },
  time:     { fontWeight: '600' },
  distance: { marginTop: 1, fontWeight: '600' },
  capacity: { marginTop: Spacing.one, fontWeight: '600' },

  chevron: {
    fontSize: 22,
    paddingRight: Spacing.one,
  },
});
