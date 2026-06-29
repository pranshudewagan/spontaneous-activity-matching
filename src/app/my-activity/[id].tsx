import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type AcceptMode = 'auto' | 'auto_criteria' | 'manual';

type ActivitySummary = {
  id: string;
  title: string;
  start_time: string;
  time_flexible: boolean;
  mode: AcceptMode;
  max_participants: number;
};

type JoinRequest = {
  id: string;
  user_id: string;
  email: string;
  status: 'interested' | 'waitlisted';
  created_at: string;
};

const MODE_LABELS: Record<AcceptMode, string> = {
  auto:          'Auto-accept',
  auto_criteria: 'Screened',
  manual:        'Manual',
};

function formatTime(iso: string, flexible: boolean): string {
  const date = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  let day: string;
  if (date.toDateString() === now.toDateString())           day = 'Today';
  else if (date.toDateString() === tomorrow.toDateString()) day = 'Tomorrow';
  else day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${time}${flexible ? ' (flexible)' : ''}`;
}

export default function ActivityRequestsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const theme   = Colors.light;

  const [activity,      setActivity]      = useState<ActivitySummary | null>(null);
  const [requests,      setRequests]      = useState<JoinRequest[]>([]);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [acting,        setActing]        = useState<string | null>(null);

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData() {
    setLoading(true);
    const [activityRes, requestsRes, countRes] = await Promise.all([
      supabase
        .from('activities')
        .select('id, title, start_time, time_flexible, mode, max_participants')
        .eq('id', id)
        .single(),
      supabase.rpc('get_join_requests_for_activity', { p_activity_id: id }),
      supabase
        .from('join_requests')
        .select('id', { count: 'exact', head: true })
        .eq('activity_id', id)
        .eq('status', 'accepted'),
    ]);
    if (activityRes.data)  setActivity(activityRes.data as ActivitySummary);
    if (requestsRes.data)  setRequests(requestsRes.data as JoinRequest[]);
    if (countRes.count != null) setAcceptedCount(countRes.count);
    setLoading(false);
  }

  async function handleRespond(requestId: string, accept: boolean) {
    setActing(requestId);
    const { error } = await supabase.rpc('host_respond_to_request', {
      p_request_id: requestId,
      p_accept:     accept,
    });
    if (error) { console.error('host_respond_to_request failed:', error); setActing(null); return; }
    setRequests(prev => prev.filter(r => r.id !== requestId));
    if (accept) setAcceptedCount(prev => prev + 1);
    setActing(null);
  }

  const pending    = requests.filter(r => r.status === 'interested');
  const waitlisted = requests.filter(r => r.status === 'waitlisted');
  const spotsLeft  = activity ? activity.max_participants - acceptedCount - 1 : 0;

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { borderBottomColor: theme.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={theme.ink} />
        </Pressable>
        <ThemedText type="title">Requests</ThemedText>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.action} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {activity && (
            <View style={[styles.summaryCard, { backgroundColor: theme.surface, borderColor: theme.line }]}>
              <View style={styles.summaryTop}>
                <ThemedText type="title" style={[styles.summaryTitle, { color: theme.ink }]} numberOfLines={1}>
                  {activity.title}
                </ThemedText>
                <View style={[styles.modeBadge, { backgroundColor: theme.accent + '1A' }]}>
                  <ThemedText style={[styles.modeBadgeText, { color: theme.accent }]}>
                    {MODE_LABELS[activity.mode]}
                  </ThemedText>
                </View>
              </View>

              <ThemedText type="label" style={[styles.summaryTime, { color: theme.muted }]}>
                {formatTime(activity.start_time, activity.time_flexible)}
              </ThemedText>

              <View style={styles.summaryBottom}>
                <ThemedText type="label" style={{ color: theme.accent }}>
                  {acceptedCount + 1} / {activity.max_participants} going
                </ThemedText>
                <Pressable
                  style={({ pressed }) => [styles.editBtn, { borderColor: theme.line, opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => router.push(`/host?id=${activity.id}`)}>
                  <ThemedText type="label" style={{ color: theme.ink }}>Edit plan</ThemedText>
                  <Feather name="edit-2" size={13} color={theme.ink} />
                </Pressable>
              </View>
            </View>
          )}

          {requests.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText type="title" style={[styles.emptyHeading, { color: theme.ink }]}>All clear</ThemedText>
              <ThemedText type="smallBold" style={[styles.emptySub, { color: theme.muted }]}>
                Requests will appear here{'\n'}when someone swipes right.
              </ThemedText>
            </View>
          ) : (
            <>
              {pending.length > 0 && (
                <View style={styles.section}>
                  <ThemedText style={[styles.sectionLabel, { color: theme.muted }]}>
                    PENDING · {pending.length}
                  </ThemedText>
                  {pending.map(req => (
                    <RequestRow
                      key={req.id}
                      request={req}
                      acting={acting === req.id}
                      spotsLeft={spotsLeft}
                      onRespond={handleRespond}
                    />
                  ))}
                </View>
              )}

              {waitlisted.length > 0 && (
                <View style={styles.section}>
                  <ThemedText style={[styles.sectionLabel, { color: theme.muted }]}>
                    WAITLISTED · {waitlisted.length}
                  </ThemedText>
                  {waitlisted.map(req => (
                    <RequestRow
                      key={req.id}
                      request={req}
                      acting={acting === req.id}
                      spotsLeft={spotsLeft}
                      onRespond={handleRespond}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

type RequestRowProps = {
  request:   JoinRequest;
  acting:    boolean;
  spotsLeft: number;
  onRespond: (id: string, accept: boolean) => void;
};

function RequestRow({ request, acting, spotsLeft, onRespond }: RequestRowProps) {
  const theme      = Colors.light;
  const canAccept  = spotsLeft > 0;

  return (
    <View style={[styles.requestRow, { borderColor: theme.line }]}>
      <View style={styles.requestInfo}>
        <ThemedText type="label" style={[styles.requestEmail, { color: theme.ink }]} numberOfLines={1}>
          {request.email}
        </ThemedText>
        {request.status === 'waitlisted' && (
          <ThemedText style={[styles.waitlistNote, { color: theme.warning }]}>waitlisted</ThemedText>
        )}
      </View>

      {acting ? (
        <ActivityIndicator size="small" color={theme.accent} />
      ) : (
        <View style={styles.requestActions}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, styles.rejectBtn, { borderColor: theme.line, opacity: pressed ? 0.7 : 1 }]}
            onPress={() => onRespond(request.id, false)}>
            <ThemedText style={[styles.actionBtnText, { color: theme.muted }]}>Reject</ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.actionBtn,
              styles.approveBtn,
              { backgroundColor: canAccept ? theme.accent : theme.line, opacity: pressed ? 0.85 : 1 },
            ]}
            disabled={!canAccept}
            onPress={() => onRespond(request.id, true)}>
            <ThemedText style={[styles.actionBtnText, { color: canAccept ? '#fff' : theme.muted }]}>Approve</ThemedText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection:    'row',
    alignItems:       'center',
    justifyContent:   'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical:   Spacing.two + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },

  content: {
    padding:    Spacing.three,
    gap:        Spacing.three,
    paddingBottom: Spacing.six,
  },

  summaryCard: {
    borderRadius: 16,
    borderWidth:  1,
    padding:      Spacing.three,
    gap:          Spacing.one + 2,
  },
  summaryTop: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.two,
  },
  summaryTitle: {
    flex:       1,
    fontSize:   18,
    fontWeight: '700',
  },
  modeBadge: {
    paddingHorizontal: 10,
    paddingVertical:    4,
    borderRadius:      20,
  },
  modeBadgeText: {
    fontSize:   12,
    fontWeight: '700',
  },
  summaryTime: {
    fontSize: 13,
  },
  summaryBottom: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginTop:       Spacing.one,
  },
  editBtn: {
    flexDirection:    'row',
    alignItems:       'center',
    gap:               6,
    paddingHorizontal: 12,
    paddingVertical:    6,
    borderRadius:      20,
    borderWidth:        1,
  },

  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    fontSize:    11,
    fontWeight:  '700',
    letterSpacing: 0.6,
    marginBottom:  2,
  },

  requestRow: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingVertical:   Spacing.two + 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap:               Spacing.two,
  },
  requestInfo: {
    flex: 1,
    gap:   2,
  },
  requestEmail: {
    fontSize: 14,
  },
  waitlistNote: {
    fontSize:   12,
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    gap:            8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical:    7,
    borderRadius:      20,
    alignItems:        'center',
    justifyContent:    'center',
  },
  rejectBtn:  { borderWidth: 1 },
  approveBtn: {},
  actionBtnText: {
    fontSize:   13,
    fontWeight: '700',
  },

  emptyState: {
    alignItems:  'center',
    paddingTop:   Spacing.six,
    gap:          Spacing.two,
  },
  emptyHeading: {
    fontSize:   20,
    fontWeight: '700',
  },
  emptySub: {
    textAlign:  'center',
    lineHeight:  22,
  },
});
