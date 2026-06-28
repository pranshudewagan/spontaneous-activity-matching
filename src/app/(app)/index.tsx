import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FilterSheet, DEFAULT_FILTERS, type Filters } from '@/components/filter-sheet';
import { SwipeCard, type SwipeCardData, CARD_H, CARD_W } from '@/components/swipe-card';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { takePickedLocation, type PickedLocation } from '@/lib/location-handoff';
import { supabase } from '@/lib/supabase';

export default function DiscoverScreen() {
  const router  = useRouter();
  const theme   = Colors.light;

  const [activities,   setActivities]   = useState<SwipeCardData[]>([]);
  const [passedIds,    setPassedIds]    = useState<Set<string>>(new Set());
  const [currentLoc,   setCurrentLoc]   = useState<PickedLocation | null>(null);
  const [filters,      setFilters]      = useState<Filters>(DEFAULT_FILTERS);
  const [loading,      setLoading]      = useState(true);
  const [sheetOpen,    setSheetOpen]    = useState(false);
  const [feedKey,      setFeedKey]      = useState(0);

  const loadFeed = useCallback(async (loc: PickedLocation, f: Filters) => {
    setLoading(true);
    setPassedIds(new Set());
    setFeedKey(k => k + 1); // force card remount so onLoad always fires
    const radiusM = f.radiusMi * 1609.34;
    const { data, error } = await supabase.rpc('nearby_activities', {
      p_lat:      loc.latitude,
      p_lng:      loc.longitude,
      p_radius_m: radiusM,
    });
    if (error) { console.error(error); setLoading(false); return; }
    let results = (data ?? []) as SwipeCardData[];
    if (f.tags.length > 0) {
      results = results.filter(a => f.tags.some(t => a.tags.includes(t)));
    }
    setActivities(results);
    // Empty feed: nothing to wait for — stop spinner now.
    // Non-empty: top card calls setLoading(false) via onImageReady once its image loads.
    if (results.length === 0) setLoading(false);
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
    setCurrentLoc(loc);
    loadFeed(loc, filters);
  }, [loadFeed, filters]);

  const reopenAfterPicker = useRef(false);
  const initialized = useRef(false);

  useFocusEffect(useCallback(() => {
    const picked = takePickedLocation();
    if (picked) {
      const next = { ...filters, center: picked };
      setFilters(next);
      if (reopenAfterPicker.current) {
        reopenAfterPicker.current = false;
        setSheetOpen(true);
      } else {
        loadFeed(picked, next);
      }
    } else if (reopenAfterPicker.current) {
      reopenAfterPicker.current = false;
      setSheetOpen(true);
    } else if (!initialized.current) {
      initialized.current = true;
      initLocation();
    }
  }, [initLocation, loadFeed, filters]));

  const handleSwipeLeft  = useCallback((id: string) => {
    setPassedIds(prev => new Set(prev).add(id));
  }, []);

  const handleSwipeRight = useCallback((id: string) => {
    // Phase 4: create join_request here
    setPassedIds(prev => new Set(prev).add(id));
  }, []);

  function handleFiltersChange(next: Filters) {
    setFilters(next);
    if (next.center) setCurrentLoc(next.center);
  }

  function handleBeforeLocationPicker() {
    // Close the sheet without reloading — useFocusEffect will reopen it on return
    reopenAfterPicker.current = true;
    setSheetOpen(false);
  }

  function handleSheetClose() {
    setSheetOpen(false);
    const loc = filters.center ?? currentLoc;
    // Wait for the sheet slide-down animation to finish before swapping the feed
    if (loc) setTimeout(() => loadFeed(loc, filters), 300);
  }

  const visible = activities.filter(a => !passedIds.has(a.id));

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.line }]}>
        <ThemedText type="title">Discover</ThemedText>
        <Pressable onPress={() => setSheetOpen(true)} hitSlop={8}>
          <Ionicons name="options-outline" size={24} color={theme.ink} />
        </Pressable>
      </View>

      {/* Stack */}
      <View style={styles.stackContainer}>
        {/* Cards always rendered once data is present — spinner overlays them */}
        {visible.length > 0 && (
          <View style={[styles.stack, { width: CARD_W, height: CARD_H + 20 }]}>
            {visible.slice(0, 3).reverse().map((activity, reversedIdx) => {
              const stackLen = Math.min(visible.length, 3);
              const idx      = stackLen - 1 - reversedIdx;
              return (
                <SwipeCard
                  key={`${activity.id}-${feedKey}`}
                  activity={activity}
                  isTop={idx === 0}
                  index={idx}
                  onSwipeLeft={handleSwipeLeft}
                  onSwipeRight={handleSwipeRight}
                  onImageReady={idx === 0 ? () => setLoading(false) : undefined}
                />
              );
            })}
          </View>
        )}

        {/* Empty state — only visible once loading is done */}
        {!loading && visible.length === 0 && (
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
        )}

        {/* Opaque spinner overlay — sits on top of cards until image is ready */}
        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: theme.bg }]}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        )}
      </View>

      <FilterSheet
        visible={sheetOpen}
        filters={filters}
        onChange={handleFiltersChange}
        onClose={handleSheetClose}
        onBeforeLocationPicker={handleBeforeLocationPicker}
      />
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

  stackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stack: { position: 'relative' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

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
