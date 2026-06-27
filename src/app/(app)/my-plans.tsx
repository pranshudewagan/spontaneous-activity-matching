import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActivityCard, type ActivityCardData } from '@/components/activity-card';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Tab = 'hosting' | 'joined';

export default function MyPlansScreen() {
  const router = useRouter();
  const theme  = Colors.light;
  const { bottom } = useSafeAreaInsets();

  const [activeTab,   setActiveTab]   = useState<Tab>('hosting');
  const [activities,  setActivities]  = useState<ActivityCardData[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);

  useEffect(() => {
    if (activeTab === 'hosting') loadHosted();
    else setLoading(false);
  }, [activeTab]);

  const swipeableRefs = useRef<Map<string, Swipeable | null>>(new Map());

  const confirmCancel = (item: ActivityCardData) => {
    swipeableRefs.current.get(item.id)?.close();
    const hasParticipants = item.accepted_count > 0;
    Alert.alert(
      'Cancel this plan?',
      hasParticipants
        ? 'People have already joined. It will be removed from discovery but they keep their chat.'
        : 'It will be permanently deleted.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, cancel it',
          style: 'destructive',
          onPress: async () => {
            const { error } = hasParticipants
              ? await supabase.from('activities').update({ status: 'cancelled' }).eq('id', item.id)
              : await supabase.from('activities').delete().eq('id', item.id);
            if (error) { console.error(error); return; }
            setActivities(prev => prev.filter(a => a.id !== item.id));
          },
        },
      ],
    );
  };

  const loadHosted = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
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
      setLoading(false);
      setRefreshing(false);
    }
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
        loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.action} />
          </View>
        ) : activities.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.center}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadHosted(true)} tintColor={theme.action} />
            }>
            <ThemedText type="body" style={{ color: theme.muted, textAlign: 'center' }}>
              You haven't posted anything yet.
            </ThemedText>
            <Pressable onPress={() => router.push('/host')} style={{ marginTop: Spacing.two }}>
              <ThemedText type="label" style={{ color: theme.accent }}>Post a plan</ThemedText>
            </Pressable>
          </ScrollView>
        ) : (
          <FlatList
            data={activities}
            keyExtractor={a => a.id}
            style={styles.fill}
            contentContainerStyle={[styles.list, { paddingBottom: bottom + 20 }]}
            renderItem={({ item }) => {
              const isPast = new Date(item.start_time) <= new Date();
              if (isPast) return <ActivityCard activity={item} muted />;
              return (
                <Swipeable
                  ref={r => { swipeableRefs.current.set(item.id, r); }}
                  friction={2}
                  overshootRight={false}
                  renderRightActions={() => (
                    <Pressable
                      style={styles.cancelAction}
                      onPress={() => confirmCancel(item)}>
                      <ThemedText style={styles.cancelActionText}>✕</ThemedText>
                    </Pressable>
                  )}>
                  <ActivityCard activity={item} />
                </Swipeable>
              );
            }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => loadHosted(true)} tintColor={theme.action} />
            }
          />
        )
      ) : (
        <ScrollView
          contentContainerStyle={styles.center}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => setRefreshing(false)} tintColor={theme.action} />
          }>
          <ThemedText type="body" style={{ color: theme.muted, textAlign: 'center', fontWeight: '600' }}>
            Nothing joined yet.
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.muted, textAlign: 'center', marginTop: Spacing.one }}>
            Find something nearby in Discover.
          </ThemedText>
          <Pressable onPress={() => router.navigate('/(app)')} style={{ marginTop: Spacing.two }}>
            <ThemedText type="label" style={{ color: theme.accent }}>Browse plans</ThemedText>
          </Pressable>
        </ScrollView>
      )}
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
    backgroundColor: '#E53E3E',
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    borderRadius: 16,
    marginBottom: Spacing.two,
    marginLeft: Spacing.two,
  },
  cancelActionText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.four },
});
