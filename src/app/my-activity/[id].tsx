import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ConfirmCard } from '@/components/confirm-card';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type ConfirmState = {
  title:         string;
  body?:         string;
  confirmLabel?: string;
  destructive?:  boolean;
  onConfirm:     () => void;
  onCancel?:     () => void;
};

type AcceptMode = 'auto' | 'auto_criteria' | 'manual';

type ActivitySummary = {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  time_flexible: boolean;
  mode: AcceptMode;
  max_participants: number;
  tags: string[];
  image_url: string | null;
};

type JoinRequest = {
  id: string;
  user_id: string;
  name: string;
  status: 'interested' | 'waitlisted';
  created_at: string;
};

type AcceptedParticipant = {
  id: string;
  user_id: string;
  name: string;
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
  const [accepted,      setAccepted]      = useState<AcceptedParticipant[]>([]);
  const [acceptedCount, setAcceptedCount] = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [acting,   setActing]   = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirm,  setConfirm]  = useState<ConfirmState | null>(null);

  const focusCount = useRef(0);
  useFocusEffect(useCallback(() => {
    focusCount.current += 1;
    if (focusCount.current === 1) return;
    if (id) loadData(true);
  }, [id]));

  useEffect(() => { if (id) loadData(); }, [id]);

  async function loadData(silent = false) {
    if (!silent) setLoading(true);
    const [activityRes, requestsRes, acceptedRes, countRes] = await Promise.all([
      supabase
        .from('activities')
        .select('id, title, description, start_time, time_flexible, mode, max_participants, tags, image_url')
        .eq('id', id)
        .single(),
      supabase.rpc('get_join_requests_for_activity', { p_activity_id: id }),
      supabase.rpc('get_accepted_participants_for_activity', { p_activity_id: id }),
      supabase
        .from('join_requests')
        .select('id', { count: 'exact', head: true })
        .eq('activity_id', id)
        .eq('status', 'accepted'),
    ]);
    if (activityRes.data)  setActivity(activityRes.data as ActivitySummary);
    if (requestsRes.data)  setRequests(requestsRes.data as JoinRequest[]);
    if (acceptedRes.data)  setAccepted(acceptedRes.data as AcceptedParticipant[]);
    if (countRes.count != null) setAcceptedCount(countRes.count);
    if (!silent) setLoading(false);
  }

  async function handleRespond(requestId: string, accept: boolean) {
    setActing(requestId);
    const { data, error } = await supabase.rpc('host_respond_to_request', {
      p_request_id: requestId,
      p_accept:     accept,
    });
    if (error) { console.error('host_respond_to_request failed:', error); setActing(null); return; }
    if (data === 'full') {
      setConfirm({
        title: 'Activity is full',
        body:  'Remove an accepted participant before approving someone new.',
        onConfirm: () => setConfirm(null),
      });
      setActing(null);
      return;
    }
    if (data === 'stale') {
      setConfirm({
        title: 'Activity is no longer active',
        body:  "This activity has been cancelled or already started, so requests can't be actioned. Refreshing…",
        onConfirm: () => { setConfirm(null); loadData(true); },
      });
      setActing(null);
      return;
    }
    if (data === 'accepted') setAcceptedCount(prev => prev + 1);
    setRequests(prev => prev.filter(r => r.id !== requestId));
    setActing(null);
    // Reload accepted list in case a waitlister was promoted during this approve
    const { data: fresh } = await supabase.rpc('get_accepted_participants_for_activity', { p_activity_id: id });
    if (fresh) setAccepted(fresh as AcceptedParticipant[]);
  }

  function confirmRemove(participant: AcceptedParticipant) {
    setConfirm({
      title: 'Remove participant?',
      body:  `${participant.name} will be removed from the activity.`,
      confirmLabel: 'Remove',
      destructive:  true,
      onConfirm: () => { setConfirm(null); handleRemove(participant.id); },
      onCancel:  () => setConfirm(null),
    });
  }

  async function handleRemove(requestId: string) {
    setRemoving(requestId);
    const { data, error } = await supabase.rpc('host_remove_participant', { p_request_id: requestId });
    if (error) { console.error('host_remove_participant failed:', error); setRemoving(null); return; }
    if (data === 'removed') {
      setAccepted(prev => prev.filter(p => p.id !== requestId));
      setAcceptedCount(prev => prev - 1);
      // Reload both lists: requests loses the promoted waitlister, accepted gains them
      const [freshRequests, freshAccepted] = await Promise.all([
        supabase.rpc('get_join_requests_for_activity', { p_activity_id: id }),
        supabase.rpc('get_accepted_participants_for_activity', { p_activity_id: id }),
      ]);
      if (freshRequests.data) setRequests(freshRequests.data as JoinRequest[]);
      if (freshAccepted.data) {
        setAccepted(freshAccepted.data as AcceptedParticipant[]);
        setAcceptedCount(freshAccepted.data.length);
      }
    }
    setRemoving(null);
  }

  const pending    = requests.filter(r => r.status === 'interested');
  const waitlisted = requests.filter(r => r.status === 'waitlisted');

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
                <View style={styles.summaryActions}>
                  <Pressable
                    style={({ pressed }) => [styles.editBtn, { borderColor: theme.line, opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => router.push({ pathname: `/chat/${activity.id}`, params: { title: activity.title, startTime: activity.start_time } })}>
                    <ThemedText type="label" style={{ color: theme.ink }}>Chat</ThemedText>
                    <Feather name="message-circle" size={13} color={theme.ink} />
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.editBtn, { borderColor: theme.line, opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => router.push(`/host?id=${activity.id}`)}>
                    <ThemedText type="label" style={{ color: theme.ink }}>Edit plan</ThemedText>
                    <Feather name="edit-2" size={13} color={theme.ink} />
                  </Pressable>
                </View>
              </View>
            </View>
          )}

          {accepted.length === 0 && requests.length === 0 ? (
            <View style={styles.emptyState}>
              <ThemedText type="title" style={[styles.emptyHeading, { color: theme.ink }]}>All clear</ThemedText>
              <ThemedText type="smallBold" style={[styles.emptySub, { color: theme.muted }]}>
                Requests will appear here{'\n'}when someone swipes right.
              </ThemedText>
            </View>
          ) : (
            <>
              {accepted.length > 0 && (
                <View style={styles.section}>
                  <ThemedText style={[styles.sectionLabel, { color: theme.muted }]}>
                    ACCEPTED · {accepted.length}
                  </ThemedText>
                  {accepted.map(p => (
                    <AcceptedRow
                      key={p.id}
                      participant={p}
                      removing={removing === p.id}
                      onRemove={confirmRemove}
                    />
                  ))}
                </View>
              )}

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
                      onRespond={handleRespond}
                    />
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
      {confirm && (
        <ConfirmCard
          title={confirm.title}
          body={confirm.body}
          confirmLabel={confirm.confirmLabel}
          destructive={confirm.destructive}
          onConfirm={confirm.onConfirm}
          onCancel={confirm.onCancel}
        />
      )}
    </SafeAreaView>
  );
}

type AcceptedRowProps = {
  participant: AcceptedParticipant;
  removing:    boolean;
  onRemove:    (p: AcceptedParticipant) => void;
};

function AcceptedRow({ participant, removing, onRemove }: AcceptedRowProps) {
  const theme      = Colors.light;
  const swipeRef   = useRef<Swipeable>(null);

  function renderRightActions() {
    return (
      <Pressable
        style={[styles.removeAction, { backgroundColor: theme.danger }]}
        onPress={() => {
          swipeRef.current?.close();
          onRemove(participant);
        }}
      >
        <Feather name="user-x" size={16} color="#fff" />
        <ThemedText style={styles.removeActionText}>Remove</ThemedText>
      </Pressable>
    );
  }

  return (
    <Swipeable ref={swipeRef} renderRightActions={renderRightActions} overshootRight={false}>
      <View style={[styles.requestRow, { borderColor: theme.line, backgroundColor: theme.bg }]}>
        <ThemedText type="label" style={[styles.requestName, { color: theme.ink, flex: 1 }]} numberOfLines={1}>
          {participant.name}
        </ThemedText>
        {removing ? (
          <ActivityIndicator size="small" color={theme.danger} />
        ) : (
          <Feather name="chevron-left" size={14} color={theme.muted} />
        )}
      </View>
    </Swipeable>
  );
}

type RequestRowProps = {
  request:   JoinRequest;
  acting:    boolean;
  onRespond: (id: string, accept: boolean) => void;
};

// Approve is always enabled — the server is the source of truth for capacity.
// If the activity is full, handleRespond surfaces the RPC's 'full' response
// as an Alert; the client never guesses.
function RequestRow({ request, acting, onRespond }: RequestRowProps) {
  const theme = Colors.light;

  return (
    <View style={[styles.requestRow, { borderColor: theme.line }]}>
      <View style={styles.requestInfo}>
        <ThemedText type="label" style={[styles.requestName, { color: theme.ink }]} numberOfLines={1}>
          {request.name}
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
              { backgroundColor: theme.accent, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={() => onRespond(request.id, true)}>
            <ThemedText style={[styles.actionBtnText, { color: '#fff' }]}>Approve</ThemedText>
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
  summaryActions: {
    flexDirection: 'row',
    gap: Spacing.two,
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
  requestName: {
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

  removeAction: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:             6,
    paddingHorizontal: 20,
    marginVertical: StyleSheet.hairlineWidth,
  },
  removeActionText: {
    color:      '#fff',
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
