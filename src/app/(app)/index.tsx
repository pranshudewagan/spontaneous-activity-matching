import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyDiscover } from '@/components/empty-discover';
import { FilterSheet, DEFAULT_FILTERS, type Filters } from '@/components/filter-sheet';
import { SwipeCard, type SwipeCardData, CARD_H, CARD_W } from '@/components/swipe-card';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { takePickedLocation, type PickedLocation } from '@/lib/location-handoff';
import { supabase } from '@/lib/supabase';

export default function DiscoverScreen() {
  const theme = Colors.light;

  const [activities,        setActivities]        = useState<SwipeCardData[]>([]);
  const [passedIds,         setPassedIds]         = useState<Set<string>>(new Set());
  const [leftSwipeHistory,  setLeftSwipeHistory]  = useState<string[]>([]);
  const [currentLoc,        setCurrentLoc]        = useState<PickedLocation | null>(null);
  const [filters,      setFilters]      = useState<Filters>(DEFAULT_FILTERS);
  const [loading,         setLoading]         = useState(true);
  const [sheetOpen,       setSheetOpen]       = useState(false);
  const [feedKey,         setFeedKey]         = useState(0);
  const [appliedFilters,  setAppliedFilters]  = useState<Filters>(DEFAULT_FILTERS);

  // Refs so callbacks can read current values without stale closures
  const passedIdsRef        = useRef<Set<string>>(new Set());
  const leftSwipeHistoryRef = useRef<string[]>([]);

  const loadFeed = useCallback(async (loc: PickedLocation, f: Filters) => {
    setLoading(true);
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
    leftSwipeHistoryRef.current = [];
    setLeftSwipeHistory([]);
    setAppliedFilters(f); // record what was actually loaded
    // Stop spinner immediately if nothing is visible after filtering out already-passed cards
    const hasVisible = results.some(a => !passedIdsRef.current.has(a.id));
    if (!hasVisible) setLoading(false);
    // Otherwise: top card signals via onImageReady once its image loads
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

  const handleSwipeLeft = useCallback((id: string) => {
    setPassedIds(prev => {
      const next = new Set(prev).add(id);
      passedIdsRef.current = next;
      return next;
    });
    const nextHistory = [...leftSwipeHistoryRef.current, id];
    leftSwipeHistoryRef.current = nextHistory;
    setLeftSwipeHistory(nextHistory);
    supabase.from('passes').insert({ activity_id: id })
      .then(({ error }) => { if (error) console.error('pass insert failed:', error); });
  }, []);

  const handleUndo = useCallback(() => {
    const history = leftSwipeHistoryRef.current;
    if (history.length === 0) return;
    const id = history[history.length - 1];
    const nextHistory = history.slice(0, -1);
    leftSwipeHistoryRef.current = nextHistory;
    setLeftSwipeHistory(nextHistory);
    setPassedIds(curr => {
      const next = new Set(curr);
      next.delete(id);
      passedIdsRef.current = next;
      return next;
    });
    supabase.from('passes').delete().eq('activity_id', id)
      .then(({ error }) => { if (error) console.error('pass delete failed:', error); });
  }, []);

  const handleSwipeRight = useCallback((id: string) => {
    // Phase 4: create join_request here
    setPassedIds(prev => {
      const next = new Set(prev).add(id);
      passedIdsRef.current = next;
      return next;
    });
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
    // Backdrop / back — discard unapplied edits, no reload
    setSheetOpen(false);
    setFilters(appliedFilters);
  }

  function handleApply() {
    setSheetOpen(false);
    const loc = filters.center ?? currentLoc;
    if (loc) setTimeout(() => loadFeed(loc, filters), 300);
  }

  const visible = activities.filter(a => !passedIds.has(a.id));
  const canUndo = leftSwipeHistory.length > 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.line }]}>
        <ThemedText type="title">Discover</ThemedText>
        <View style={styles.headerActions}>
          <Pressable onPress={handleUndo} hitSlop={8} disabled={!canUndo}>
            <Feather
              name="rotate-ccw"
              size={22}
              color={canUndo ? theme.ink : theme.muted}
            />
          </Pressable>
          <Pressable onPress={() => setSheetOpen(true)} hitSlop={8}>
            <Ionicons name="options-outline" size={24} color={theme.ink} />
          </Pressable>
        </View>
      </View>

      {/* Stack */}
      <View style={styles.stackContainer}>
        {/* Empty state always in the background once loaded — no pop-in after last swipe */}
        {!loading && <EmptyDiscover onWidenRadius={() => setSheetOpen(true)} />}

        {/* Card stack floats above the empty state as a centered absolute overlay */}
        {visible.length > 0 && (
          <View style={styles.stackFloat}>
            <View style={{ width: CARD_W, height: CARD_H + 20 }}>
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
          </View>
        )}

        {/* Opaque spinner overlay — sits on top of everything until image is ready */}
        {loading && (
          <View style={[styles.loadingOverlay, { backgroundColor: theme.bg }]}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        )}
      </View>

      <FilterSheet
        visible={sheetOpen}
        filters={filters}
        appliedFilters={appliedFilters}
        onChange={handleFiltersChange}
        onClose={handleSheetClose}
        onApply={handleApply}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },

  stackContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackFloat: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },

});
