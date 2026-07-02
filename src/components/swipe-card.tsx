import { useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  LinearTransition,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';

import { TagChip } from '@/components/tag-chip';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { tagColor } from '@/lib/tags';

const { width: SCREEN_W } = Dimensions.get('window');
export const CARD_W  = SCREEN_W - Spacing.three * 2;
export const IMAGE_H = Math.round(CARD_W * 4 / 3);
export const CARD_H  = IMAGE_H;

const SWIPE_THRESHOLD = SCREEN_W * 0.3;

export type SwipeCardData = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  time_flexible: boolean;
  max_participants: number;
  accepted_count: number;
  distance_m: number;
  tags: string[];
  image_url: string | null;
  mode: 'auto' | 'auto_criteria' | 'manual';
};

type Props = {
  activity: SwipeCardData;
  isTop: boolean;
  index: number;
  cardHeight?: number;
  onSwipeLeft: (id: string) => void;
  onSwipeRight: (id: string) => void;
  onImageReady?: () => void;
};

function formatTime(iso: string, flexible: boolean): string {
  const date = new Date(iso);
  const now   = new Date();
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
  return miles < 1 ? 'Nearby' : `${Math.round(miles)} mi away`;
}

function joinPolicyLabel(mode: SwipeCardData['mode']): string {
  if (mode === 'auto')          return 'Open';
  if (mode === 'auto_criteria') return 'Auto select';
  return 'Approval';
}

export function SwipeCard({ activity, isTop, index, cardHeight, onSwipeLeft, onSwipeRight, onImageReady }: Props) {
  const theme       = Colors.light;
  const accentColor = tagColor(activity.tags[0] ?? '');

  const [isTruncated,  setIsTruncated]  = useState(false);
  const [expanded,     setExpanded]     = useState(false);
  const [tagsPanelH,   setTagsPanelH]   = useState(0);

  // No-image cards have nothing to wait for — signal ready immediately on mount
  useEffect(() => {
    if (!activity.image_url) onImageReady?.();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tiltOffset = (index % 3) * 1.5;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);


  const gesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate(e => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.2;
    })
    .onEnd(e => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const dir = e.translationX > 0 ? 1 : -1;
        // Notify immediately so the next card is swipeable without waiting for the fly-off
        if (dir < 0) runOnJS(onSwipeLeft)(activity.id);
        else         runOnJS(onSwipeRight)(activity.id);
        translateX.value = withSpring(dir * (SCREEN_W + CARD_W), { damping: 40 });
      } else {
        translateX.value = withSpring(0, { damping: 20 });
        translateY.value = withSpring(0, { damping: 20 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: isTop ? translateX.value : 0 },
      { translateY: isTop ? translateY.value : 0 },
      { scale: isTop
          ? interpolate(Math.abs(translateX.value), [0, SCREEN_W], [1, 0.95], Extrapolation.CLAMP)
          : 1 },
      { rotate: isTop
          ? `${interpolate(translateX.value, [-SCREEN_W, SCREEN_W], [-12 + tiltOffset, 12], Extrapolation.CLAMP)}deg`
          : `${tiltOffset}deg` },
    ],
  }));

  const passStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, -SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const yesStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP),
  }));

  const spotsLeft = activity.max_participants - activity.accepted_count - 1;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.cardShadow, { height: cardHeight ?? CARD_H }, cardStyle]}>
      <View style={styles.card}>

        {/* Image / placeholder fills full card */}
        {activity.image_url ? (
          <Image
            source={{ uri: activity.image_url }}
            style={[styles.image, { backgroundColor: activity.tags.length > 0 ? accentColor + '4D' : theme.line }]}
            contentFit="cover"
            transition={250}
            onLoad={() => onImageReady?.()}
            onError={() => onImageReady?.()}
          />
        ) : (
          <View style={[styles.image, { backgroundColor: activity.tags.length > 0 ? accentColor + '4D' : theme.line }]} />
        )}

        {/* Distance badge — top left over image */}
        <View style={styles.distanceBadge}>
          <ThemedText style={styles.distanceText}>{formatDistance(activity.distance_m)}</ThemedText>
        </View>

        {/* Swipe overlays */}
        <Animated.View style={[styles.overlay, styles.overlayLeft, yesStyle, { borderColor: theme.accent }]}>
          <ThemedText style={[styles.overlayTextYes, { color: theme.accent }]}>YES</ThemedText>
        </Animated.View>
        <Animated.View style={[styles.overlay, styles.overlayRight, passStyle, { borderColor: theme.action }]}>
          <ThemedText style={[styles.overlayTextPass, { color: theme.action }]}>PASS</ThemedText>
        </Animated.View>

        {/* Fixed bottom — show more/less + divider + tags + spots, never animated */}
        <View
          style={[styles.fixedPanel, { backgroundColor: theme.bg }]}
          onLayout={e => setTagsPanelH(e.nativeEvent.layout.height)}
        >
          {isTruncated && (
            <Pressable onPress={() => setExpanded(p => !p)} style={styles.showMoreRow}>
              <ThemedText style={[styles.showMore, { color: theme.muted }]}>
                {expanded ? 'Show less' : 'Show more'}
              </ThemedText>
            </Pressable>
          )}
          <View style={styles.tagsAndSpots}>
            <View style={styles.tags}>
              {activity.tags.slice(0, 3).map(slug => (
                <TagChip key={slug} slug={slug} />
              ))}
            </View>
            <View style={styles.spotsCol}>
              <ThemedText type="label" style={[styles.spotsText, { color: theme.accent }]}>
                {joinPolicyLabel(activity.mode)}
              </ThemedText>
              <ThemedText type="label" style={[styles.spotsText, { color: theme.accent }]}>
                {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left` : 'Full'}
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Title + time + description — expands upward */}
        <Animated.View
          style={[styles.infoPanel, { bottom: tagsPanelH, backgroundColor: theme.bg }]}
          layout={LinearTransition.duration(200)}
        >
          <ThemedText type="title" style={[styles.title, { color: theme.ink }]} numberOfLines={1}>
            {activity.title}
          </ThemedText>
          <ThemedText type="label" style={[styles.time, { color: theme.action }]} numberOfLines={1}>
            {formatTime(activity.start_time, activity.time_flexible)}
          </ThemedText>
          {!!activity.description && (
            <Pressable onPress={() => setExpanded(p => !p)} disabled={!isTruncated}>
              <ThemedText
                type="caption"
                style={[styles.description, { color: theme.ink }]}
                numberOfLines={isTruncated && !expanded ? 3 : undefined}
                onTextLayout={e => {
                  if (!isTruncated && e.nativeEvent.lines.length > 3) setIsTruncated(true);
                }}
              >
                {activity.description}
              </ThemedText>
            </Pressable>
          )}
        </Animated.View>

      </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  cardShadow: {
    width: CARD_W,
    height: CARD_H,
    borderRadius: 20,
    position: 'absolute',
    shadowColor: '#1A100D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 18,
    elevation: 10,
  },
  card: {
    flex: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  distanceBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  distanceText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },

  overlay: {
    position: 'absolute',
    top: 28,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 3,
    borderRadius: 8,
  },
  overlayLeft: {
    left: 20,
    transform: [{ rotate: '-15deg' }],
  },
  overlayRight: {
    right: 20,
    transform: [{ rotate: '15deg' }],
  },
  overlayTextPass: { fontSize: 22, fontWeight: '800' },
  overlayTextYes:  { fontSize: 22, fontWeight: '800' },

  // Fixed bottom — show more/less + tags + spots, never participates in layout animation
  fixedPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.38)',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.three,
    zIndex: 2,
  },
  showMoreRow: {
    marginBottom: Spacing.two,
  },
  tagsAndSpots: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', flex: 1 },
  spotsCol: { alignItems: 'flex-end', flexShrink: 0 },
  spotsText: { fontWeight: '800' },
  // Expandable panel — title + time + description, sits above fixed panel
  infoPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.38)',
    padding: Spacing.three,
    paddingBottom: Spacing.one,
    gap: 4,
    zIndex: 1,
    overflow: 'hidden',
  },
  title:       { fontSize: 20, fontWeight: '700', lineHeight: 26, color: '#fff' },
  time:        { fontWeight: '800' },
  description: { color: 'rgba(255,255,255,0.85)', fontWeight: '700' },
  showMore:    { color: 'rgba(255,255,255,0.6)', fontWeight: '700', fontSize: 12 },
});
