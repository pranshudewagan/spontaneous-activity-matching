import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Dimensions, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { tagColor } from '@/lib/tags';

const { width: SCREEN_W } = Dimensions.get('window');
export const CARD_W       = SCREEN_W - Spacing.three * 2;
export const IMAGE_H      = 260;
export const INFO_H       = 144;
export const CARD_H       = IMAGE_H + INFO_H;

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
};

type Props = {
  activity: SwipeCardData;
  isTop: boolean;
  index: number;
  onSwipeLeft: (id: string) => void;
  onSwipeRight: (id: string) => void;
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
  return miles < 0.1 ? 'Nearby' : `~${miles.toFixed(1)} mi away`;
}

export function SwipeCard({ activity, isTop, index, onSwipeLeft, onSwipeRight }: Props) {
  const theme      = Colors.light;
  const accentColor = tagColor(activity.tags[0] ?? '');

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const scale  = 1 - index * 0.04;
  const offsetY = index * 10;

  const gesture = Gesture.Pan()
    .enabled(isTop)
    .onUpdate(e => {
      translateX.value = e.translationX;
      translateY.value = e.translationY * 0.2;
    })
    .onEnd(e => {
      if (Math.abs(e.translationX) > SWIPE_THRESHOLD) {
        const dir = e.translationX > 0 ? 1 : -1;
        translateX.value = withSpring(dir * (SCREEN_W + CARD_W), { damping: 40 }, () => {
          if (dir < 0) runOnJS(onSwipeLeft)(activity.id);
          else         runOnJS(onSwipeRight)(activity.id);
        });
      } else {
        translateX.value = withSpring(0, { damping: 20 });
        translateY.value = withSpring(0, { damping: 20 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: isTop ? translateX.value : 0 },
      { translateY: isTop ? translateY.value + offsetY : offsetY },
      { scale: isTop
          ? interpolate(Math.abs(translateX.value), [0, SCREEN_W], [1, 0.95], Extrapolation.CLAMP)
          : scale },
      { rotate: isTop
          ? `${interpolate(translateX.value, [-SCREEN_W, SCREEN_W], [-12, 12], Extrapolation.CLAMP)}deg`
          : '0deg' },
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
      <Animated.View style={[styles.card, { backgroundColor: theme.surface }, cardStyle]}>

        {/* Image / placeholder */}
        {activity.image_url ? (
          <Image
            source={{ uri: activity.image_url }}
            style={styles.image}
            contentFit="cover"
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: accentColor + '18' }]}>
            <View style={[styles.placeholderDot, { backgroundColor: accentColor }]} />
          </View>
        )}

        {/* Swipe overlays */}
        <Animated.View style={[styles.overlay, styles.overlayLeft, passStyle]}>
          <ThemedText style={styles.overlayTextPass}>PASS</ThemedText>
        </Animated.View>
        <Animated.View style={[styles.overlay, styles.overlayRight, yesStyle]}>
          <ThemedText style={styles.overlayTextYes}>YES</ThemedText>
        </Animated.View>

        {/* Info */}
        <View style={[styles.info, { borderTopColor: theme.line }]}>
          <ThemedText type="title" style={[styles.title, { color: theme.ink }]} numberOfLines={1}>
            {activity.title}
          </ThemedText>
          <ThemedText type="label" style={[styles.time, { color: theme.action }]} numberOfLines={1}>
            {formatTime(activity.start_time, activity.time_flexible)}
          </ThemedText>
          <View style={styles.metaRow}>
            <ThemedText type="caption" style={{ color: theme.muted }}>
              {formatDistance(activity.distance_m)}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.accent }}>
              {spotsLeft > 0 ? `${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left` : 'Full'}
            </ThemedText>
          </View>
          {activity.tags.length > 0 && (
            <View style={styles.tags}>
              {activity.tags.slice(0, 3).map(slug => (
                <View key={slug} style={[styles.chip, { backgroundColor: tagColor(slug) + '20', borderColor: tagColor(slug) + '50' }]}>
                  <ThemedText type="caption" style={{ color: tagColor(slug), fontWeight: '600' }}>
                    {slug.replace('_', ' ')}
                  </ThemedText>
                </View>
              ))}
            </View>
          )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_W,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#1A100D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 6,
    position: 'absolute',
  },

  image: {
    width: '100%',
    height: IMAGE_H,
  },
  imagePlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderDot: {
    width: 48,
    height: 48,
    borderRadius: 24,
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
    borderColor: '#D13E2A',
    transform: [{ rotate: '-15deg' }],
  },
  overlayRight: {
    right: 20,
    borderColor: '#F4845F',
    transform: [{ rotate: '15deg' }],
  },
  overlayTextPass: { fontSize: 22, fontWeight: '800', color: '#D13E2A' },
  overlayTextYes:  { fontSize: 22, fontWeight: '800', color: '#F4845F' },

  info: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  title:   { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  time:    { fontWeight: '600' },
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },

  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 6 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
});
