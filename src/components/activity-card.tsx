import { Image } from 'expo-image';
import { useState } from 'react';
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
  request_count?: number;
  distance_m?: number;
  tags: string[];
  image_url?: string | null;
};

type Props = {
  activity: ActivityCardData;
  onPress?: () => void;
  muted?: boolean;
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
  return miles < 1 ? 'Nearby' : `~${miles.toFixed(1)} mi away`;
}

export function ActivityCard({ activity, onPress, muted = false }: Props) {
  const theme        = Colors.light;
  const accentColor  = muted ? theme.muted : tagColor(activity.tags[0] ?? '');
  const going        = activity.accepted_count + 1;
  const total        = activity.max_participants;
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line, opacity: muted ? 0.5 : 1 }]}
      onPress={onPress}>

      {/* Square thumbnail */}
      {activity.image_url && !imgFailed ? (
        <Image
          source={{ uri: activity.image_url }}
          style={styles.swatch}
          contentFit="cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <View style={[styles.swatch, { backgroundColor: accentColor + '26' }]}>
          <View style={[styles.swatchDot, { backgroundColor: accentColor }]} />
        </View>
      )}

      {/* Content */}
      <View style={styles.content}>
        <ThemedText type="label" style={[styles.title, { color: theme.ink }]} numberOfLines={1}>
          {activity.title}
        </ThemedText>
        <ThemedText type="caption" style={[styles.time, { color: theme.action }]} numberOfLines={1}>
          {formatTime(activity.start_time, activity.time_flexible)}
        </ThemedText>
        {activity.distance_m != null && (
          <ThemedText type="caption" style={[styles.distance, { color: theme.muted }]}>
            {formatDistance(activity.distance_m)}
          </ThemedText>
        )}
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
    width: 101,
    height: 101,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
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
  time:     { fontWeight: '800' },
  distance: { marginTop: 1, fontWeight: '600' },
  capacity: { marginTop: Spacing.one, fontWeight: '600' },

  chevron: {
    fontSize: 22,
    paddingRight: Spacing.one,
  },
});
