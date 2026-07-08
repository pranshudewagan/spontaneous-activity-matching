import { Feather, Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TagChip } from '@/components/tag-chip';
import { ThemedText } from '@/components/themed-text';
import { Colors, DisplayFontBold, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const { width: SCREEN_W } = Dimensions.get('window');
const IMAGE_H = Math.round(SCREEN_W * 3 / 4);

type Attendee = {
  user_id:    string;
  name:       string;
  age:        number;
  photo:      string | null;
  request_id?: string;
};

type EventInfo = {
  id:               string;
  title:            string;
  description:      string | null;
  start_time:       string;
  time_flexible:    boolean;
  max_participants: number;
  tags:             string[];
  image_url:        string | null;
  mode:             'auto' | 'auto_criteria' | 'manual';
  is_host:          boolean;
  host:             Attendee;
  participants:     Attendee[];
};

function formatTime(iso: string): string {
  const date     = new Date(iso);
  const now      = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  let day: string;
  if (date.toDateString() === now.toDateString())           day = 'Today';
  else if (date.toDateString() === tomorrow.toDateString()) day = 'Tomorrow';
  else day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${time}`;
}

function Avatar({ photo, name, size = 48 }: { photo: string | null; name: string; size?: number }) {
  const theme = Colors.light;
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}
        contentFit="cover"
      />
    );
  }
  return (
    <View style={[styles.avatar, styles.avatarFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.accent + '20' }]}>
      <ThemedText style={[styles.avatarInitials, { color: theme.accent, fontSize: size * 0.35 }]}>
        {initials}
      </ThemedText>
    </View>
  );
}

function AttendeeRow({ attendee, isHost }: { attendee: Attendee; isHost: boolean }) {
  const theme = Colors.light;
  return (
    <View style={styles.attendeeRow}>
      <Avatar photo={attendee.photo} name={attendee.name} size={44} />
      <View style={styles.attendeeInfo}>
        <View style={styles.attendeeNameRow}>
          <ThemedText style={[styles.attendeeName, { color: theme.ink }]}>{attendee.name}</ThemedText>
          {isHost && (
            <View style={[styles.hostBadge, { backgroundColor: theme.action + '18', borderColor: theme.action + '40' }]}>
              <ThemedText style={[styles.hostBadgeText, { color: theme.action }]}>Host</ThemedText>
            </View>
          )}
        </View>
        <ThemedText style={[styles.attendeeAge, { color: theme.muted }]}>{attendee.age} years old</ThemedText>
      </View>
    </View>
  );
}

export default function ActivityEventInfoScreen() {
  const { id, fromChat } = useLocalSearchParams<{ id: string; fromChat?: string }>();
  const router   = useRouter();
  const theme    = Colors.light;
  const insets   = useSafeAreaInsets();

  const [info,    setInfo]    = useState<EventInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);

  useEffect(() => {
    if (!id) return;
    supabase.rpc('get_activity_event_info', { p_activity_id: id }).then(({ data, error }) => {
      if (error || !data) { setError(true); setLoading(false); return; }
      setInfo(data as EventInfo);
      setLoading(false);
    });
  }, [id]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg }]}>
        <ActivityIndicator color={theme.action} />
      </View>
    );
  }

  if (error || !info) {
    return (
      <View style={[styles.center, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
        <Pressable style={styles.backBtnAbsolute} onPress={() => router.back()} hitSlop={8}>
          <Feather name="arrow-left" size={22} color={theme.ink} />
        </Pressable>
        <ThemedText style={{ color: theme.muted }}>Activity not found or access denied.</ThemedText>
      </View>
    );
  }

  const allAttendees: Array<{ attendee: Attendee; isHost: boolean }> = [
    { attendee: info.host, isHost: true },
    ...info.participants.filter(p => p.user_id !== info.host.user_id).map(p => ({ attendee: p, isHost: false })),
  ];

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Back button — floats over image */}
      <Pressable
        style={[styles.backBtn, { top: insets.top + Spacing.two, backgroundColor: 'rgba(0,0,0,0.45)' }]}
        onPress={() => router.back()}
        hitSlop={8}
      >
        <Feather name="arrow-left" size={18} color="#fff" />
      </Pressable>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 200 }}>
        {/* Image */}
        {info.image_url ? (
          <Image source={{ uri: info.image_url }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder, { backgroundColor: theme.line }]} />
        )}

        {/* Content */}
        <View style={[styles.content, { backgroundColor: theme.bg }]}>

          <ThemedText style={[styles.title, { color: theme.ink }]}>{info.title}</ThemedText>

          <View style={styles.timeRow}>
            <ThemedText style={[styles.time, { color: theme.action }]}>
              {formatTime(info.start_time)}
            </ThemedText>
            {info.time_flexible && (
              <View style={[styles.flexBadge, { backgroundColor: theme.accent + '20', borderColor: theme.accent + '50' }]}>
                <ThemedText type="caption" style={{ color: theme.accent, fontWeight: '600' }}>Flexible</ThemedText>
              </View>
            )}
          </View>

          {info.tags.length > 0 && (
            <View style={styles.tags}>
              {info.tags.map(slug => <TagChip key={slug} slug={slug} />)}
            </View>
          )}

          {!!info.description && (
            <ThemedText style={[styles.description, { color: theme.ink }]}>
              {info.description}
            </ThemedText>
          )}

          {/* Going */}
          <View style={styles.section}>
            <ThemedText style={[styles.sectionLabel, { color: theme.muted }]}>
              GOING · {allAttendees.length} / {info.max_participants}
            </ThemedText>
            {allAttendees.map(({ attendee, isHost }) => (
              <AttendeeRow key={attendee.user_id} attendee={attendee} isHost={isHost} />
            ))}
          </View>

        </View>
      </ScrollView>

      {/* Pinned bottom — info box + chat button */}
      <View style={[styles.pinnedBar, { paddingBottom: insets.bottom + Spacing.three, backgroundColor: theme.bg }]}>
        <View style={[styles.infoBox, { backgroundColor: theme.accent + '12', borderColor: theme.accent + '30' }]}>
          <Ionicons name="information-circle-outline" size={33} color={theme.accent} style={{ marginTop: 1 }} />
          <ThemedText type="caption" style={{ color: theme.accent, lineHeight: 18, flex: 1, fontWeight: '700' }}>
            Meet spot is coordinated in chat — open chat below to see where you're meeting.
          </ThemedText>
        </View>
        <Pressable
          style={[styles.chatBtn, { backgroundColor: theme.action }]}
          onPress={() => fromChat ? router.back() : router.push({ pathname: '/chat/[id]', params: { id, title: info.title, startTime: info.start_time } })}
        >
          <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
          <ThemedText style={styles.chatBtnText}>Open Chat</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  backBtn: {
    position:     'absolute',
    left:          Spacing.three,
    zIndex:        10,
    width:         36,
    height:        36,
    borderRadius:  18,
    alignItems:    'center',
    justifyContent:'center',
  },
  backBtnAbsolute: {
    position: 'absolute',
    top:      Spacing.four,
    left:     Spacing.three,
  },

  image: {
    width:  SCREEN_W,
    height: IMAGE_H,
  },
  imagePlaceholder: { opacity: 0.35 },

  content: {
    marginTop:    -24,
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    padding:       Spacing.three * 1.5,
    gap:           Spacing.three,
  },

  title: {
    fontSize:   26,
    fontFamily: DisplayFontBold,
    lineHeight:  32,
  },

  timeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           Spacing.two,
  },
  time: {
    fontSize:   18,
    fontWeight: '700',
    lineHeight: 24,
  },
  flexBadge: {
    borderWidth:       1,
    borderRadius:      20,
    paddingHorizontal: Spacing.two,
    paddingVertical:   2,
  },

  tags: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           Spacing.one + 2,
  },

  description: {
    fontSize:   15,
    fontWeight: '600',
    lineHeight:  22,
  },

  section: { gap: Spacing.two + 2 },
  sectionLabel: {
    fontSize:      11,
    fontWeight:    '700',
    letterSpacing:  0.6,
  },

  attendeeRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            Spacing.two + 4,
  },
  avatar: {
    overflow: 'hidden',
  },
  avatarFallback: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  avatarInitials: { fontWeight: '700' },
  attendeeInfo:   { flex: 1, gap: 2 },
  attendeeNameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:            Spacing.two,
  },
  attendeeName: {
    fontSize:   15,
    fontWeight: '600',
  },
  attendeeAge: {
    fontSize: 13,
  },
  hostBadge: {
    borderWidth:       1,
    borderRadius:      20,
    paddingHorizontal:  8,
    paddingVertical:    2,
  },
  hostBadgeText: {
    fontSize:   11,
    fontWeight: '700',
  },

  infoBox: {
    borderWidth:       1,
    borderRadius:      12,
    paddingHorizontal: Spacing.three * 0.75,
    paddingVertical:   Spacing.two + 2,
    flexDirection:     'row',
    alignItems:        'flex-start',
    gap:               Spacing.one + 2,
  },

  pinnedBar: {
    position:          'absolute',
    bottom:             0,
    left:               0,
    right:              0,
    paddingHorizontal:  Spacing.three * 1.5,
    paddingTop:         Spacing.two,
    gap:                Spacing.three,
  },
  chatBtn: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:             Spacing.two,
    borderRadius:   12,
    paddingVertical: Spacing.two + 4,
  },
  chatBtnText: {
    color:      '#fff',
    fontSize:    16,
    fontWeight: '600',
  },
});
