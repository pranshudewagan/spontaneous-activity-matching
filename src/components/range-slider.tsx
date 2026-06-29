import { useEffect } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { StyleSheet, View } from 'react-native';

const THUMB = 24;

type Props = {
  min: number;
  max: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  fillColor?: string;
  trackColor?: string;
};

export function RangeSlider({
  min, max, low, high, onChange,
  fillColor  = '#2AAFA8',
  trackColor = '#EDE5E1',
}: Props) {
  const trackW   = useSharedValue(0);
  const lowPos   = useSharedValue((low  - min) / (max - min));
  const highPos  = useSharedValue((high - min) / (max - min));
  const lowStart = useSharedValue(0);
  const hiStart  = useSharedValue(0);

  // Sync when props change externally (e.g. loading saved criteria)
  useEffect(() => {
    lowPos.value  = (low  - min) / (max - min);
    highPos.value = (high - min) / (max - min);
  }, [low, high, min, max]);

  function emit(lo: number, hi: number) {
    onChange(lo, hi);
  }

  const lowGesture = Gesture.Pan()
    .onBegin(() => { lowStart.value = lowPos.value; })
    .onUpdate(e => {
      if (trackW.value === 0) return;
      const usable = trackW.value - THUMB;
      const gap    = 1 / (max - min);
      lowPos.value = Math.max(0, Math.min(highPos.value - gap, lowStart.value + e.translationX / usable));
      runOnJS(emit)(
        Math.round(min + lowPos.value  * (max - min)),
        Math.round(min + highPos.value * (max - min)),
      );
    });

  const highGesture = Gesture.Pan()
    .onBegin(() => { hiStart.value = highPos.value; })
    .onUpdate(e => {
      if (trackW.value === 0) return;
      const usable = trackW.value - THUMB;
      const gap    = 1 / (max - min);
      highPos.value = Math.max(lowPos.value + gap, Math.min(1, hiStart.value + e.translationX / usable));
      runOnJS(emit)(
        Math.round(min + lowPos.value  * (max - min)),
        Math.round(min + highPos.value * (max - min)),
      );
    });

  const lowThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: lowPos.value * (trackW.value - THUMB) }],
  }));

  const highThumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: highPos.value * (trackW.value - THUMB) }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    left:  lowPos.value  * (trackW.value - THUMB) + THUMB / 2,
    width: (highPos.value - lowPos.value) * (trackW.value - THUMB),
  }));

  return (
    <View
      style={styles.container}
      onLayout={e => { trackW.value = e.nativeEvent.layout.width; }}
    >
      <View style={[styles.track, { backgroundColor: trackColor }]} />
      <Animated.View style={[styles.fill, { backgroundColor: fillColor }, fillStyle]} />
      <GestureDetector gesture={lowGesture}>
        <Animated.View style={[styles.thumb, { backgroundColor: fillColor }, lowThumbStyle]} />
      </GestureDetector>
      <GestureDetector gesture={highGesture}>
        <Animated.View style={[styles.thumb, { backgroundColor: fillColor }, highThumbStyle]} />
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: THUMB,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
    left:  THUMB / 2,
    right: THUMB / 2,
  },
  fill: {
    height: 4,
    borderRadius: 2,
    position: 'absolute',
  },
  thumb: {
    width:        THUMB,
    height:       THUMB,
    borderRadius: THUMB / 2,
    position:     'absolute',
    shadowColor:  '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius:  4,
    elevation:     3,
  },
});
