import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { SwipeCard, type SwipeCardData, CARD_H, CARD_W } from '@/components/swipe-card';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { takePickedLocation, type PickedLocation } from '@/lib/location-handoff';
import { supabase } from '@/lib/supabase';

const DEFAULT_RADIUS_M = 16093; // 10 miles

export default function DiscoverScreen() {
  const router = useRouter();
  const theme  = Colors.light;

  const [activities, setActivities] = useState<SwipeCardData[]>([]);
  const [passedIds,  setPassedIds]  = useState<Set<string>>(new Set());
  const [center,     setCenter]     = useState<PickedLocation | null>(null);
  const [loading,    setLoading]    = useState(true);

  const loadFeed = useCallback(async (loc: PickedLocation) => {
    setLoading(true);
    setPassedIds(new Set());
    try {
      const { data, error } = await supabase.rpc('nearby_activities', {
        p_lat:      loc.latitude,
        p_lng:      loc.longitude,
        p_radius_m: DEFAULT_RADIUS_M,
      });
      if (error) { console.error(error); return; }
      setActivities((data ?? []) as SwipeCardData[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const initLocation = useCallback(async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { setLoading(false); return; }
    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const loc: PickedLocation = {
      latitude:  pos.coords.latitude,
      longitude: pos.coords.longitude,
      label:     'Current location',
    };
    setCenter(loc);
    loadFeed(loc);
  }, [loadFeed]);

  const initialized = useRef(false);
  useFocusEffect(useCallback(() => {
    const picked = takePickedLocation();
    if (picked) {
      setCenter(picked);
      loadFeed(picked);
    } else if (!initialized.current) {
      initialized.current = true;
      initLocation();
    }
  }, [initLocation, loadFeed]));

  const handleSwipeLeft = useCallback((id: string) => {
    setPassedIds(prev => new Set(prev).add(id));
  }, []);

  const handleSwipeRight = useCallback((id: string) => {
    // Phase 4: create join_request here
    setPassedIds(prev => new Set(prev).add(id));
  }, []);

  const visible = activities.filter(a => !passedIds.has(a.id));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.line }]}>
        <ThemedText type="title">Discover</ThemedText>
        <Pressable
          style={[styles.locationPill, { backgroundColor: theme.surface, borderColor: theme.line }]}
          onPress={() => router.push(
            center
              ? { pathname: '/location-picker', params: { lat: center.latitude, lng: center.longitude } }
              : '/location-picker'
          )}>
          <ThemedText type="caption" style={{ color: theme.muted }}>📍 </ThemedText>
          <ThemedText type="caption" style={{ color: theme.ink, fontWeight: '600' }} numberOfLines={1}>
            {center ? center.label : 'Set location'}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.muted }}> · 10 mi</ThemedText>
        </Pressable>
      </View>

      {/* Stack */}
      <View style={styles.stackContainer}>
        {loading ? (
          <ActivityIndicator color={theme.action} size="large" />
        ) : visible.length === 0 ? (
          <View style={styles.empty}>
            <ThemedText type="title" style={{ color: theme.ink, textAlign: 'center' }}>
              Nothing nearby right now
            </ThemedText>
            <ThemedText type="body" style={[styles.emptyBody, { color: theme.muted }]}>
              Try a wider radius, check back later, or post your own plan.
            </ThemedText>
            <Pressable
              style={[styles.emptyBtn, { borderColor: theme.action }]}
              onPress={() => router.push('/host')}>
              <ThemedText type="label" style={{ color: theme.action }}>Post a plan</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.stack, { width: CARD_W, height: CARD_H + 20 }]}>
            {visible.slice(0, 3).reverse().map((activity, reversedIdx) => {
              const stackLen = Math.min(visible.length, 3);
              const idx      = stackLen - 1 - reversedIdx;
              return (
                <SwipeCard
                  key={activity.id}
                  activity={activity}
                  isTop={idx === 0}
                  index={idx}
                  onSwipeLeft={handleSwipeLeft}
                  onSwipeRight={handleSwipeRight}
                />
              );
            })}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.one + 2,
    maxWidth: 200,
  },

  stackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: { position: 'relative' },

  empty: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  emptyBody: { textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    marginTop: Spacing.one,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
});
