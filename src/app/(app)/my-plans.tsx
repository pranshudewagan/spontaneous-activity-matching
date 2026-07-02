import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Swipeable, TouchableOpacity } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityCard, type ActivityCardData } from '@/components/activity-card';
import { ActivityDetailModal, type ActivityDetail } from '@/components/activity-detail-modal';
import { EmptyHosting, EmptyJoined } from '@/components/empty-my-plans';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Tab = 'hosting' | 'joined';

type JoinedActivity = ActivityCardData & ActivityDetail & {
  join_status: 'interested' | 'waitlisted' | 'accepted';
  joined_at: string;
};

const STATUS_LABEL: Record<JoinedActivity['join_status'], string> = {
  accepted:   'Accepted',
  waitlisted: 'Waitlisted',
  interested: 'Pending',
};

export default function MyPlansScreen() {
  const router = useRouter();
  const theme  = Colors.light;

  const STATUS_COLOR: Record<JoinedActivity['join_status'], string> = {
    accepted:   theme.success,
    waitlisted: theme.warning,
    interested: theme.warning,
  };
  const { bottom } = useSafeAreaInsets();

  const [activeTab,        setActiveTab]        = useState<Tab>('hosting');
  const [activities,       setActivities]       = useState<ActivityCardData[]>([]);
  const [joinedActivities, setJoinedActivities] = useState<JoinedActivity[]>([]);
  const [loadingHosted,    setLoadingHosted]    = useState(true);
  const [loadingJoined,    setLoadingJoined]    = useState(true);
  const [refreshing,       setRefreshing]       = useState(false);
  const [detailActivity,   setDetailActivity]   = useState<ActivityDetail | null>(null);
  const joinedSwipeRefs = useRef<Map<string, Swipeable | null>>(new Map());
  const focusCount      = useRef(0);

  // Load both tabs in parallel on mount — user only sees hosting's spinner
  useEffect(() => {
    loadHosted();
    loadJoined();
  }, []);

  // Re-focus: silently refresh both behind whatever tab is visible
  useFocusEffect(useCallback(() => {
    focusCount.current += 1;
    if (focusCount.current === 1) return;
    loadHosted(false, true);
    loadJoined(false, true);
  }, []));

  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const confirmCancel = (item: ActivityCardData, isPast = false) => {
    swipeableRefs.current.get(item.id)?.close();
    const hasParticipants = item.accepted_count > 0;
    const title   = isPast ? 'Delete this plan?' : 'Cancel this plan?';
    const message = isPast
      ? 'It will be permanently deleted.'
      : hasParticipants
        ? 'People have already joined. It will be removed from discovery but they keep their chat.'
        : 'It will be permanently deleted.';
    const confirmText = isPast ? 'Yes, delete it' : 'Yes, cancel it';
    Alert.alert(title, message, [
      { text: 'No', style: 'cancel' },
      {
        text: confirmText,
        style: 'destructive',
        onPress: async () => {
          if (hasParticipants) {
            const { error } = await supabase.from('activities').update({ status: 'cancelled' }).eq('id', item.id);
            if (error) { console.error(error); return; }
          } else {
            const { error } = await supabase.functions.invoke('delete-activity', {
              body: { activity_id: item.id },
            });
            if (error) { console.error(error); return; }
          }
          setActivities(prev => prev.filter(a => a.id !== item.id));
        },
      },
    ]);
  };

  const loadHosted = async (isRefresh = false, silent = false) => {
    if (!silent) {
      if (isRefresh) setRefreshing(true);
      else setLoadingHosted(true);
    }
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 0, lng = 0;
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      const { data, error } = await supabase.rpc('my_hosted_activities', { p_lat: lat, p_lng: lng });
      if (error) { console.error(error); return; }
      setActivities((data ?? []) as ActivityCardData[]);
    } finally {
      if (!silent) { setLoadingHosted(false); setRefreshing(false); }
    }
  };

  const loadJoined = async (isRefresh = false, silent = false) => {
    if (!silent) {
      if (isRefresh) setRefreshing(true);
      else setLoadingJoined(true);
    }
    try {
      let lat: number | null = null, lng: number | null = null;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }
      const { data, error } = await supabase.rpc('my_joined_activities', {
        p_lat: lat ?? 0,
        p_lng: lng ?? 0,
      });
      if (error) { console.error(error); return; }
      const rows = ((data ?? []) as JoinedActivity[]).map(r => ({
        ...r,
        distance_m: lat !== null ? r.distance_m : undefined,
      }));
      setJoinedActivities(rows);
    } finally {
      if (!silent) { setLoadingJoined(false); setRefreshing(false); }
    }
  };

  const confirmLeave = (item: JoinedActivity) => {
    joinedSwipeRefs.current.get(item.id)?.close();
    const isAccepted = item.join_status === 'accepted';
    const isPast     = new Date(item.start_time) <= new Date();
    const title   = isAccepted ? 'Leave this activity?' : 'Withdraw request?';
    const message = isAccepted
      ? isPast
        ? "You'll lose chat access. This can't be undone."
        : "You'll lose your spot. The next person on the waitlist will be offered your place."
      : "Your request will be withdrawn.";
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: isAccepted ? 'Leave' : 'Withdraw',
        style: 'destructive',
        onPress: async () => {
          const { error } = await supabase.rpc('participant_leave', { p_activity_id: item.id });
          if (error) { console.error('participant_leave failed:', error); return; }
          setJoinedActivities(prev => prev.filter(a => a.id !== item.id));
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.line }]}>
        <ThemedText type="title">My plans</ThemedText>
        <Pressable
          style={[styles.postBtn, { backgroundColor: theme.action }]}
          onPress={() => router.push('/host')}
          hitSlop={8}>
          <ThemedText type="label" style={styles.postBtnText}>+ Post</ThemedText>
        </Pressable>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: theme.line }]}>
        {(['hosting', 'joined'] as Tab[]).map(tab => (
          <Pressable
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: theme.action, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}>
            <ThemedText
              type="label"
              style={{ color: activeTab === tab ? theme.ink : theme.muted, textTransform: 'capitalize', fontSize: 17, fontWeight: '600' }}>
              {tab}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {/* Content */}
      {activeTab === 'hosting' ? (
        loadingHosted ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.action} />
          </View>
        ) : activities.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.center}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadHosted(true)} tintColor={theme.accent} />
            }>
            <EmptyHosting />
          </ScrollView>
        ) : (
          <FlatList
            data={activities}
            keyExtractor={a => a.id}
            style={styles.fill}
            contentContainerStyle={[styles.list, { paddingBottom: bottom + 20 }]}
            renderItem={({ item }) => {
              const isPast    = new Date(item.start_time) <= new Date();
              const canDelete = isPast && item.accepted_count === 0;
              if (isPast && !canDelete) return <ActivityCard activity={item} muted />;
              return (
                <Swipeable
                  ref={r => { swipeableRefs.current.set(item.id, r); }}
                  friction={2}
                  overshootRight={false}
                  renderRightActions={() => (
                    <Pressable
                      style={[styles.cancelAction, { backgroundColor: theme.danger }]}
                      onPress={() => confirmCancel(item, canDelete)}>
                      <ThemedText style={styles.cancelActionText}>✕</ThemedText>
                    </Pressable>
                  )}>
                  <View style={{ backgroundColor: theme.bg }}>
                    {!isPast ? (
                      <TouchableOpacity activeOpacity={0.7} onPress={() => router.push(`/my-activity/${item.id}`)}>
                        <ActivityCard activity={item} />
                        {(item.request_count ?? 0) > 0 && (
                          <View style={[styles.requestBadge, { backgroundColor: theme.warning + '18', borderColor: theme.warning + '50' }]}>
                            <View style={[styles.requestDot, { backgroundColor: theme.warning }]} />
                            <ThemedText type="caption" style={{ color: theme.warning, fontWeight: '600' }}>
                              {item.request_count} {item.request_count === 1 ? 'request' : 'requests'}
                            </ThemedText>
                          </View>
                        )}
                      </TouchableOpacity>
                    ) : (
                      <ActivityCard activity={item} muted />
                    )}
                  </View>
                </Swipeable>
              );
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadHosted(true)} tintColor={theme.accent} />
            }
          />
        )
      ) : loadingJoined ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.action} />
        </View>
      ) : joinedActivities.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.center}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadJoined(true)} tintColor={theme.accent} />
          }>
          <EmptyJoined />
        </ScrollView>
      ) : (
        <FlatList
          data={joinedActivities}
          keyExtractor={a => a.id}
          style={styles.fill}
          contentContainerStyle={[styles.list, { paddingBottom: bottom + 20 }]}
          renderItem={({ item }) => (
            <Swipeable
              ref={r => { joinedSwipeRefs.current.set(item.id, r); }}
              friction={2}
              overshootRight={false}
              renderRightActions={() => (
                <Pressable
                  style={[styles.leaveAction, { backgroundColor: theme.danger }]}
                  onPress={() => confirmLeave(item)}>
                  <ThemedText style={styles.leaveActionText}>✕</ThemedText>
                </Pressable>
              )}>
              <View style={{ backgroundColor: theme.bg }}>
                <ActivityCard activity={item} onPress={() => setDetailActivity(item)} />
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.join_status] + '18', borderColor: STATUS_COLOR[item.join_status] + '50' }]}>
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLOR[item.join_status] }]} />
                  <ThemedText type="caption" style={{ color: STATUS_COLOR[item.join_status], fontWeight: '600' }}>
                    {STATUS_LABEL[item.join_status]}
                  </ThemedText>
                </View>
              </View>
            </Swipeable>
          )}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadJoined(true)} tintColor={theme.accent} />
          }
        />
      )}
      <ActivityDetailModal
        activity={detailActivity}
        onClose={() => { setDetailActivity(null); loadJoined(false, true); }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  postBtn:     { borderRadius: 20, paddingHorizontal: Spacing.three, paddingVertical: Spacing.one + 2 },
  postBtnText: { color: '#FFFFFF' },

  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.three,
  },
  tab: {
    marginRight: Spacing.four,
    paddingVertical: Spacing.three,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },

  fill:   { flex: 1 },
  list:   { padding: Spacing.three, flexGrow: 1 },

  cancelAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    borderRadius: 16,
    marginBottom: Spacing.two,
    marginLeft: Spacing.two,
  },
  cancelActionText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  leaveAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    borderRadius: 16,
    marginBottom: Spacing.two,
    marginLeft: Spacing.two,
  },
  leaveActionText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: -Spacing.two,
    marginBottom: Spacing.two,
    marginLeft: Spacing.two,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  requestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: -Spacing.two,
    marginBottom: Spacing.two,
    marginLeft: Spacing.two,
  },
  requestDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
