import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TagChip } from '@/components/tag-chip';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

const { width: SCREEN_W } = Dimensions.get('window');
const IMAGE_H = Math.round(SCREEN_W * 3 / 4);

export type ActivityDetail = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  time_flexible: boolean;
  max_participants: number;
  accepted_count: number;
  tags: string[];
  image_url: string | null;
  mode: 'auto' | 'auto_criteria' | 'manual';
  distance_m?: number;
};

type Props = {
  activity: ActivityDetail | null;
  onClose: () => void;
};

function formatTime(iso: string): string {
  const date     = new Date(iso);
  const now      = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  let day: string;
  if (date.toDateString() === now.toDateString())           day = 'Today';
  else if (date.toDateString() === tomorrow.toDateString()) day = 'Tomorrow';
  else day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  return `${day} · ${time}`;
}

function formatDistance(meters: number): string {
  const miles = meters / 1609.34;
  return miles < 1 ? 'Nearby' : `${Math.round(miles)} mi away`;
}

function joinPolicyLabel(mode: ActivityDetail['mode']): string {
  if (mode === 'auto')          return 'Open';
  if (mode === 'auto_criteria') return 'Auto select';
  return 'Approval';
}

export function ActivityDetailModal({ activity, onClose }: Props) {
  const theme  = Colors.light;
  const insets = useSafeAreaInsets();

  if (!activity) return null;

  const going    = activity.accepted_count + 1;
  const total    = activity.max_participants;

  return (
    <Modal
      visible={!!activity}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        {/* Handle bar — two lines */}
        <View style={styles.handleBar}>
          <View style={[styles.handle, { backgroundColor: theme.line }]} />
          <View style={[styles.handle, { backgroundColor: theme.line }]} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.five }}
          showsVerticalScrollIndicator={false}
          bounces
        >
          {/* Image */}
          {activity.image_url ? (
            <Image
              source={{ uri: activity.image_url }}
              style={styles.image}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: theme.line }]} />
          )}

          <View style={styles.content}>
            {/* Title */}
            <ThemedText style={[styles.title, { color: theme.ink }]}>
              {activity.title}
            </ThemedText>

            {/* Time + flexible badge */}
            <View style={styles.timeRow}>
              <ThemedText style={[styles.time, { color: theme.action }]}>
                {formatTime(activity.start_time)}
              </ThemedText>
              {activity.time_flexible && (
                <View style={[styles.flexBadge, { backgroundColor: theme.accent + '20', borderColor: theme.accent + '50' }]}>
                  <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '600' }}>
                    Flexible
                  </ThemedText>
                </View>
              )}
            </View>

            {/* Distance */}
            {activity.distance_m != null && (
              <View style={styles.distanceRow}>
                <Ionicons name="location-outline" size={13} color={theme.muted} />
                <ThemedText type="caption" style={[styles.distanceText, { color: theme.muted }]}>
                  {formatDistance(activity.distance_m)}
                </ThemedText>
              </View>
            )}

            {/* Mode + going */}
            <View style={styles.modeRow}>
              <ThemedText style={{ fontSize: 15, color: theme.accent, fontWeight: '700' }}>
                {joinPolicyLabel(activity.mode)}
              </ThemedText>
              <ThemedText style={{ fontSize: 15, color: theme.muted }}>
                {' · '}{going} / {total} going
              </ThemedText>
            </View>

            {/* Tags */}
            {activity.tags.length > 0 && (
              <View style={styles.tags}>
                {activity.tags.map(slug => (
                  <TagChip key={slug} slug={slug} />
                ))}
              </View>
            )}

            {/* Description */}
            {!!activity.description && (
              <ThemedText style={[styles.description, { color: theme.ink }]}>
                {activity.description}
              </ThemedText>
            )}

            {/* Meet spot note */}
            <View style={[styles.infoBox, { backgroundColor: theme.accent + '12', borderColor: theme.accent + '30' }]}>
              <Ionicons name="information-circle-outline" size={33} color={theme.accent} style={styles.infoIcon} />
              <ThemedText type="caption" style={{ color: theme.accent, lineHeight: 18, flex: 1, fontWeight: '700' }}>
                Meet spot is coordinated in chat — you'll get access once you're in.
              </ThemedText>
            </View>
          </View>
        </ScrollView>

        {/* Close button */}
        <Pressable
          style={[styles.closeBtn, { backgroundColor: theme.surface, borderColor: theme.line, top: insets.top + Spacing.two }]}
          onPress={onClose}
          hitSlop={12}
        >
          <ThemedText style={[styles.closeBtnText, { color: theme.muted }]}>✕</ThemedText>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  handleBar: {
    alignItems: 'center',
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    gap: 3,
  },
  handle: {
    width: 36,
    height: 3,
    borderRadius: 1.5,
  },

  scroll: {
    flex: 1,
  },

  image: {
    width: SCREEN_W,
    height: IMAGE_H,
  },
  imagePlaceholder: {
    opacity: 0.4,
  },

  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    gap: Spacing.two + 4,
  },

  title: {
    fontSize: 26,
    fontWeight: '700',
    lineHeight: 32,
  },

  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  time: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
  },
  flexBadge: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
  },

  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  distanceText: {
    fontSize: 15,
    fontWeight: '500',
  },

  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },

  description: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },

  infoBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    marginTop: Spacing.one,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.one + 2,
  },
  infoIcon: {
    marginTop: 1,
  },

  closeBtn: {
    position: 'absolute',
    right: Spacing.three,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  closeBtnText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 14,
  },
});
