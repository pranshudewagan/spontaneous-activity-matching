import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type ChatMessage = {
  id:           string;
  body:         string;
  created_at:   string;
  sender_id:    string;
  sender_name:  string;
  sender_photo: string | null;
  is_own:       boolean;
};

type ListItem =
  | { type: 'message';   msg: ChatMessage; isOldestInGroup: boolean; isNewestInGroup: boolean }
  | { type: 'timestamp'; label: string };

const AVATAR_SIZE = 32;
const PAGE_SIZE   = 30;

function formatTimestamp(iso: string): string {
  const date    = new Date(iso);
  const now     = new Date();
  const today   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay  = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000);
  const time    = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (diffDays === 0) return time;
  if (diffDays === 1) return `Yesterday · ${time}`;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) + ` · ${time}`;
}

function Avatar({ photo, name }: { photo: string | null; name: string }) {
  const theme    = Colors.light;
  const initials = name.split(' ').map(w => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?';
  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2 }}
        contentFit="cover"
      />
    );
  }
  return (
    <View style={{
      width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
      backgroundColor: theme.accent + '20', alignItems: 'center', justifyContent: 'center',
    }}>
      <ThemedText style={{ color: theme.accent, fontSize: AVATAR_SIZE * 0.38, fontWeight: '700' }}>
        {initials}
      </ThemedText>
    </View>
  );
}

export default function ChatScreen() {
  const { id, title, startTime } = useLocalSearchParams<{ id: string; title: string; startTime: string }>();
  const router  = useRouter();
  const theme   = Colors.light;
  const insets  = useSafeAreaInsets();

  const [messages,     setMessages]     = useState<ChatMessage[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [loadingMore,  setLoadingMore]  = useState(false);
  const [hasMore,      setHasMore]      = useState(true);
  const [inputText,    setInputText]    = useState('');
  const [sending,      setSending]      = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const seenIds       = useRef<Set<string>>(new Set());
  const senderCache   = useRef<Record<string, { name: string; photo: string | null }>>({});
  const flatListRef   = useRef<FlatList>(null);
  const isNearBottom  = useRef(true);

  const [newMessageCount, setNewMessageCount] = useState(0);

  const isReadOnly = startTime
    ? new Date(startTime).getTime() + 24 * 60 * 60 * 1000 < Date.now()
    : false;

  const keyboardOffset = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', (e) => {
      Animated.timing(keyboardOffset, {
        toValue: e.endCoordinates.height,
        duration: e.duration / 2,
        useNativeDriver: false,
      }).start();
    });
    const hide = Keyboard.addListener('keyboardWillHide', (e) => {
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: e.duration / 2,
        useNativeDriver: false,
      }).start();
    });
    return () => { show.remove(); hide.remove(); };
  }, [keyboardOffset]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id ?? null));
  }, []);

  const ingestMessages = useCallback((msgs: ChatMessage[]) => {
    msgs.forEach(m => {
      seenIds.current.add(m.id);
      senderCache.current[m.sender_id] = { name: m.sender_name, photo: m.sender_photo };
    });
  }, []);

  const loadMessages = useCallback(async (before?: string) => {
    const { data, error } = await supabase.rpc('get_chat_messages', {
      p_activity_id: id,
      p_before:      before ?? new Date().toISOString(),
      p_limit:       PAGE_SIZE,
    });
    if (error || !data) { setLoading(false); return; }
    const msgs = data as ChatMessage[];
    ingestMessages(msgs);
    if (before) {
      setMessages(prev => [...prev, ...msgs]);
    } else {
      setMessages(msgs);
    }
    setHasMore(msgs.length === PAGE_SIZE);
    setLoading(false);
  }, [id, ingestMessages]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `activity_id=eq.${id}` },
        async (payload) => {
          const raw = payload.new as Record<string, unknown>;
          const rawId = raw.id as string;
          if (seenIds.current.has(rawId)) return;
          seenIds.current.add(rawId);

          const senderId = raw.sender_id as string;
          let sender = senderCache.current[senderId];
          if (!sender) {
            const { data: p } = await supabase
              .from('profiles')
              .select('name, photos')
              .eq('id', senderId)
              .single();
            sender = {
              name:  (p?.name as string | null) ?? 'Unknown',
              photo: ((p?.photos as string[] | null)?.[0]) ?? null,
            };
            senderCache.current[senderId] = sender;
          }

          const { data: { user } } = await supabase.auth.getUser();
          const msg: ChatMessage = {
            id:           rawId,
            body:         raw.body as string,
            created_at:   raw.created_at as string,
            sender_id:    senderId,
            sender_name:  sender.name,
            sender_photo: sender.photo,
            is_own:       senderId === user?.id,
          };
          setMessages(prev => [msg, ...prev]);
          if (!isNearBottom.current) setNewMessageCount(n => n + 1);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewMessageCount(0);
  }, []);

  const handleScroll = useCallback((e: { nativeEvent: { contentOffset: { y: number } } }) => {
    const y = e.nativeEvent.contentOffset.y;
    const near = y < 80;
    if (near && !isNearBottom.current) setNewMessageCount(0);
    isNearBottom.current = near;
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const oldest = messages[messages.length - 1];
    if (oldest) await loadMessages(oldest.created_at);
    setLoadingMore(false);
  }, [loadingMore, hasMore, messages, loadMessages]);

  const sendMessage = useCallback(async () => {
    const body = inputText.trim();
    if (!body || !currentUserId || sending) return;
    setInputText('');
    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimistic: ChatMessage = {
      id:           tempId,
      body,
      created_at:   new Date().toISOString(),
      sender_id:    currentUserId,
      sender_name:  'You',
      sender_photo: null,
      is_own:       true,
    };
    setMessages(prev => [optimistic, ...prev]);
    scrollToBottom();

    const { data: inserted, error } = await supabase
      .from('messages')
      .insert({ activity_id: id, sender_id: currentUserId, body })
      .select('id, created_at')
      .single();

    if (error) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInputText(body);
      setSending(false);
      Alert.alert('Message not sent', 'Something went wrong. Your message has been restored — tap send to try again.');
      return;
    }

    seenIds.current.add(inserted.id as string);
    setMessages(prev =>
      prev.map(m =>
        m.id === tempId
          ? { ...m, id: inserted.id as string, created_at: inserted.created_at as string }
          : m
      )
    );
    setSending(false);
  }, [inputText, currentUserId, id, sending]);

  // Build flat list mixing message items and timestamp separators.
  // Data is newest-first (matches inverted FlatList).
  // In inverted FlatList: index 0 = visual bottom, higher index = visual top.
  // isOldestInGroup = chronologically oldest in a same-sender run = visual TOP of group.
  // isNewestInGroup = chronologically newest in a run = visual BOTTOM of group.
  // Timestamp is inserted AFTER the message in data (= visual ABOVE it in inverted)
  // whenever there is a >5-min gap from the next-older message.
  const listItems = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [];
    for (let i = 0; i < messages.length; i++) {
      const msg   = messages[i];
      const older = messages[i + 1];
      const newer = messages[i - 1];

      const isOldestInGroup = !older || older.sender_id !== msg.sender_id;
      const isNewestInGroup = !newer || newer.sender_id !== msg.sender_id;

      items.push({ type: 'message', msg, isOldestInGroup, isNewestInGroup });

      const gapMs = older
        ? new Date(msg.created_at).getTime() - new Date(older.created_at).getTime()
        : Infinity;
      if (gapMs > 5 * 60 * 1000) {
        items.push({ type: 'timestamp', label: formatTimestamp(msg.created_at) });
      }
    }
    return items;
  }, [messages]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'timestamp') {
      return (
        <View style={styles.timestampRow}>
          <ThemedText style={[styles.timestampText, { color: theme.muted }]}>{item.label}</ThemedText>
        </View>
      );
    }

    const { msg, isOldestInGroup, isNewestInGroup } = item;
    // In inverted FlatList, marginBottom of a component = visual space ABOVE the item's slot.
    // isOldestInGroup = visual top of group → add inter-group spacing above it.
    const mb = isOldestInGroup ? Spacing.two + 4 : 2;

    if (msg.is_own) {
      return (
        <View style={[styles.rowOwn, { marginBottom: mb }]}>
          <View style={[styles.bubbleOwn, { backgroundColor: theme.action }]}>
            <ThemedText style={styles.bubbleTextOwn}>{msg.body}</ThemedText>
          </View>
        </View>
      );
    }

    return (
      <View style={[styles.rowOther, { marginBottom: mb }]}>
        {/* Avatar slot — always 32 px wide so bubbles stay aligned */}
        <View style={styles.avatarSlot}>
          {isNewestInGroup && <Avatar photo={msg.sender_photo} name={msg.sender_name} />}
        </View>
        <View style={styles.bubbleOtherWrapper}>
          {isOldestInGroup && (
            <ThemedText style={[styles.senderName, { color: theme.muted }]}>
              {msg.sender_name}
            </ThemedText>
          )}
          <View style={[styles.bubbleOther, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText style={[styles.bubbleTextOther, { color: theme.ink }]}>{msg.body}</ThemedText>
          </View>
        </View>
      </View>
    );
  }, [theme]);

  if (loading) {
    return (
      <View style={[styles.loadingRoot, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
        <ActivityIndicator color={theme.action} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: theme.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerSide}>
          <Feather name="arrow-left" size={22} color={theme.ink} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.ink }]} numberOfLines={1}>
          {title ?? 'Chat'}
        </ThemedText>
        <Pressable
          style={styles.headerSide}
          onPress={() => router.push({ pathname: '/activity/[id]', params: { id, title, startTime, fromChat: '1' } })}
          hitSlop={8}
        >
          <Feather name="users" size={20} color={theme.ink} />
        </Pressable>
      </View>

      <Animated.View style={[styles.flex, { paddingBottom: keyboardOffset }]}>
        <View style={styles.flex}>
          <FlatList
            ref={flatListRef}
            inverted
            data={listItems}
            keyExtractor={(item, index) =>
              item.type === 'message' ? item.msg.id : `ts-${index}`
            }
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <ThemedText style={[styles.emptyText, { color: theme.muted }]}>
                  Be the first to say something
                </ThemedText>
                <ThemedText style={[styles.emptySubtext, { color: theme.muted }]}>
                  Agree on where to meet here
                </ThemedText>
              </View>
            }
            ListFooterComponent={
              loadingMore
                ? <ActivityIndicator color={theme.muted} style={styles.loadMoreIndicator} />
                : null
            }
            showsVerticalScrollIndicator={false}
          />
          <View
            style={[styles.newMsgPill, { opacity: newMessageCount > 0 ? 1 : 0 }]}
            pointerEvents={newMessageCount > 0 ? 'auto' : 'none'}
          >
            <Pressable style={styles.newMsgPillInner} onPress={scrollToBottom}>
              <Feather name="chevron-down" size={13} color="#fff" />
              <ThemedText style={styles.newMsgText}>
                {newMessageCount === 1 ? '1 new message' : `${newMessageCount} new messages`}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => setNewMessageCount(0)} hitSlop={8} style={styles.newMsgDismiss}>
              <Feather name="x" size={13} color="rgba(255,255,255,0.7)" />
            </Pressable>
          </View>
        </View>

        {isReadOnly ? (
          <View style={[styles.readOnlyBar, { borderTopColor: theme.line, paddingBottom: insets.bottom + Spacing.two }]}>
            <ThemedText style={[styles.readOnlyText, { color: theme.muted }]}>
              Chat closed · 24 hours after activity start
            </ThemedText>
          </View>
        ) : (
          <View style={[styles.inputBar, { borderTopColor: theme.line, paddingBottom: insets.bottom + Spacing.one, backgroundColor: theme.bg }]}>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.ink }]}
              placeholder="Facilitate..."
              placeholderTextColor={theme.muted}
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />
            <Pressable
              style={[
                styles.sendBtn,
                { backgroundColor: inputText.trim() ? theme.action : theme.line },
              ]}
              onPress={sendMessage}
              disabled={!inputText.trim() || sending}
            >
              <Feather name="send" size={16} color={inputText.trim() ? '#fff' : theme.muted} />
            </Pressable>
          </View>
        )}
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  flex:        { flex: 1 },
  loadingRoot: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: {
    flexDirection:    'row',
    alignItems:       'center',
    paddingHorizontal: Spacing.three,
    paddingBottom:    Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide:  { width: 36 },
  headerTitle: {
    flex:       1,
    fontSize:   16,
    fontWeight: '700',
    textAlign:  'center',
  },

  listContent: {
    paddingHorizontal: Spacing.three,
    paddingTop:        Spacing.three,
    paddingBottom:     Spacing.two,
  },

  newMsgPill: {
    position:          'absolute',
    bottom:             Spacing.two,
    alignSelf:         'center',
    flexDirection:     'row',
    alignItems:        'center',
    backgroundColor:   'rgba(0,0,0,0.72)',
    borderRadius:       20,
    overflow:          'hidden',
  },
  newMsgPillInner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:                4,
    paddingLeft:        Spacing.two,
    paddingRight:       Spacing.one + 2,
    paddingVertical:    Spacing.one + 2,
  },
  newMsgText: {
    color:      '#fff',
    fontSize:   12,
    fontWeight: '600',
  },
  newMsgDismiss: {
    paddingHorizontal: Spacing.one + 2,
    paddingVertical:   Spacing.one + 2,
  },

  timestampRow: {
    alignItems:    'center',
    paddingVertical: Spacing.two,
    marginBottom:  2,
  },
  timestampText: {
    fontSize:   12,
    fontWeight: '500',
  },

  rowOwn: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
  },
  bubbleOwn: {
    maxWidth:            '75%',
    borderRadius:         18,
    borderBottomRightRadius: 4,
    paddingHorizontal:   Spacing.three,
    paddingVertical:     Spacing.two,
  },
  bubbleTextOwn: {
    color:      '#fff',
    fontSize:   15,
    lineHeight: 21,
  },

  rowOther: {
    flexDirection: 'row',
    alignItems:    'flex-end',
    gap:            Spacing.one + 2,
  },
  avatarSlot: {
    width:  AVATAR_SIZE,
    height: AVATAR_SIZE,
    justifyContent: 'flex-end',
    alignItems:     'center',
  },
  bubbleOtherWrapper: {
    maxWidth: '75%',
    gap:       3,
  },
  senderName: {
    fontSize:    12,
    fontWeight:  '600',
    marginLeft:  Spacing.two,
    marginBottom: 1,
  },
  bubbleOther: {
    borderRadius:        18,
    borderBottomLeftRadius: 4,
    paddingHorizontal:   Spacing.three,
    paddingVertical:     Spacing.two,
    alignSelf:           'flex-start',
  },
  bubbleTextOther: {
    fontSize:   15,
    lineHeight: 21,
  },

  loadMoreIndicator: { padding: Spacing.three },

  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: Spacing.three * 3,
    gap:             Spacing.one,
  },
  emptyText: {
    fontSize:   15,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize:   13,
    fontWeight: '400',
  },

  readOnlyBar: {
    paddingTop:        Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems:        'center',
    borderTopWidth:    StyleSheet.hairlineWidth,
  },
  readOnlyText: {
    fontSize:      13,
    fontWeight:    '500',
    paddingVertical: Spacing.two,
  },

  inputBar: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    paddingHorizontal: Spacing.three,
    paddingTop:        Spacing.two,
    gap:               Spacing.two,
    borderTopWidth:    StyleSheet.hairlineWidth,
  },
  input: {
    flex:              1,
    borderRadius:      20,
    paddingHorizontal: Spacing.three,
    paddingVertical:   Platform.OS === 'ios' ? Spacing.two : Spacing.one + 2,
    fontSize:          15,
    maxHeight:         120,
    lineHeight:        20,
  },
  sendBtn: {
    width:          36,
    height:         36,
    borderRadius:   18,
    alignItems:     'center',
    justifyContent: 'center',
  },
});
