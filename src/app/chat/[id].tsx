import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, // used for load-more spinner
  Alert,
  Animated,
  type DimensionValue,
  Dimensions,
  FlatList,
  Keyboard,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

const SKELETON_BUBBLES: Array<{ own: boolean; width: DimensionValue }> = [
  { own: false, width: '58%' },
  { own: true,  width: '42%' },
  { own: false, width: '70%' },
  { own: false, width: '45%' },
  { own: true,  width: '60%' },
  { own: true,  width: '35%' },
];

function ChatSkeletonScreen({ title }: { title: string }) {
  const theme  = Colors.light;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pulse  = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulse]);

  return (
    <View style={[styles.root, { backgroundColor: theme.bg }]}>
      <View style={[styles.header, { paddingTop: insets.top, borderBottomColor: theme.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={8} style={styles.headerSide}>
          <Feather name="arrow-left" size={22} color={theme.ink} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: theme.ink }]} numberOfLines={1}>
          {title}
        </ThemedText>
        <View style={styles.headerSide} />
      </View>
      <Animated.View style={{ flex: 1, opacity: pulse, paddingHorizontal: Spacing.three, paddingTop: Spacing.three }}>
        {SKELETON_BUBBLES.map((b, i) => (
          <View key={i} style={{ flexDirection: 'row', justifyContent: b.own ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
            {!b.own && <View style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2, backgroundColor: theme.line }} />}
            <View style={{ width: b.width, height: 40, borderRadius: 18, backgroundColor: theme.line }} />
          </View>
        ))}
      </Animated.View>
      <View style={[styles.inputBar, { borderTopColor: theme.line, paddingBottom: insets.bottom + Spacing.one, backgroundColor: theme.bg }]}>
        <View style={{ flex: 1, height: 40, borderRadius: 20, backgroundColor: theme.backgroundElement }} />
        <View style={[styles.sendBtn, { backgroundColor: theme.line }]} />
      </View>
    </View>
  );
}

type ChatMessage = {
  id:           string;
  body:         string | null;  // null when deleted
  created_at:   string;
  sender_id:    string;
  sender_name:  string;
  sender_photo: string | null;
  is_own:       boolean;
  edited_at:    string | null;
  deleted_at:   string | null;
};

type ListItem =
  | { type: 'message';   msg: ChatMessage; isOldestInGroup: boolean; isNewestInGroup: boolean }
  | { type: 'timestamp'; label: string };

const AVATAR_SIZE  = 32;
const PAGE_SIZE    = 30;
const SWIPE_REVEAL   = 72; // px — how far left bubbles slide to reveal timestamps
const SCREEN_HEIGHT  = Dimensions.get('window').height;
const MENU_WIDTH     = 184;
// Pixel heights of extra row content that push the timestamp away from the bubble center.
const SENDER_NAME_OFFSET = 20; // senderName fontSize:12 (~16px) + marginBottom:1 + gap:3
const EDITED_OFFSET      = 17; // editedLabel fontSize:11 (~14px) + gap:2-3

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
  const [sending,        setSending]        = useState(false);
  const [currentUserId,  setCurrentUserId]  = useState<string | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [menuMessage,     setMenuMessage]     = useState<ChatMessage | null>(null);
  const [menuAnchorY,     setMenuAnchorY]     = useState(0);
  const [deletingMessage, setDeletingMessage] = useState<ChatMessage | null>(null);

  const menuScale        = useRef(new Animated.Value(0.88)).current;
  const toastOpacity     = useRef(new Animated.Value(0)).current;
  const toastTranslateY  = useRef(new Animated.Value(-16)).current;
  const toastTimer       = useRef<ReturnType<typeof setTimeout> | null>(null);

  const seenIds       = useRef<Set<string>>(new Set());
  const senderCache   = useRef<Record<string, { name: string; photo: string | null }>>({});
  const flatListRef   = useRef<FlatList>(null);
  const isNearBottom  = useRef(true);

  const [newMessageCount, setNewMessageCount] = useState(0);

  const isReadOnly = startTime
    ? new Date(startTime).getTime() + 24 * 60 * 60 * 1000 < Date.now()
    : false;

  const dismissMenu = useCallback(() => setMenuMessage(null), []);

  const showToast = useCallback(() => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastOpacity.setValue(0);
    toastTranslateY.setValue(-16);
    Animated.parallel([
      Animated.timing(toastOpacity,    { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(toastTranslateY, { toValue: 0, useNativeDriver: true, tension: 280, friction: 22 }),
    ]).start();
    toastTimer.current = setTimeout(() => {
      Animated.timing(toastOpacity, { toValue: 0, duration: 250, useNativeDriver: true }).start();
    }, 1500);
  }, [toastOpacity, toastTranslateY]);

  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const swipeX       = useRef(new Animated.Value(0)).current;
  // Clamp visually via interpolate so native driver can own the transform.
  const swipeXClamped = useRef(
    swipeX.interpolate({
      inputRange:  [-SWIPE_REVEAL, 0],
      outputRange: [-SWIPE_REVEAL, 0],
      extrapolate: 'clamp',
    })
  ).current;
  const panResponder   = useRef(
    PanResponder.create({
      // Only claim clearly horizontal left-drags so vertical scroll still works.
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > Math.abs(dy) * 2 && dx < -5,
      onPanResponderMove: (_, { dx }) => {
        swipeX.setValue(Math.min(0, dx));
      },
      onPanResponderRelease: () => {
        Animated.spring(swipeX, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(swipeX, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;


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
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `activity_id=eq.${id}` },
        (payload) => {
          const raw = payload.new as Record<string, unknown>;
          setMessages(prev => prev.map(m =>
            m.id === (raw.id as string)
              ? {
                  ...m,
                  body:       (raw.deleted_at ? null : raw.body) as string | null,
                  edited_at:  (raw.edited_at  as string | null) ?? null,
                  deleted_at: (raw.deleted_at as string | null) ?? null,
                }
              : m
          ));
        }
      )
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
            edited_at:    null,
            deleted_at:   null,
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

  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
    setInputText('');
  }, []);

  const handleLongPress = useCallback((msg: ChatMessage, anchorY: number) => {
    if (!msg.is_own || msg.deleted_at || isReadOnly) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    menuScale.setValue(0.88);
    setMenuMessage(msg);
    setMenuAnchorY(anchorY);
    Animated.spring(menuScale, { toValue: 1, useNativeDriver: true, tension: 300, friction: 22 }).start();
  }, [isReadOnly, menuScale]);

  const sendMessage = useCallback(async () => {
    const body = inputText.trim();
    if (!body || !currentUserId || sending) return;

    if (editingMessage) {
      const target = editingMessage;
      setSending(true);
      setMessages(prev => prev.map(m =>
        m.id === target.id ? { ...m, body, edited_at: new Date().toISOString() } : m
      ));
      setInputText('');
      setEditingMessage(null);

      const { error } = await supabase.rpc('edit_message', { p_message_id: target.id, p_new_body: body });
      if (error) {
        setMessages(prev => prev.map(m => m.id === target.id ? target : m));
        setInputText(body);
        setEditingMessage(target);
        Alert.alert('Edit failed', 'Could not save the edit. Your changes have been restored.');
      }
      setSending(false);
      return;
    }

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
      edited_at:    null,
      deleted_at:   null,
    };
    setMessages(prev => [optimistic, ...prev]);
    // Defer until the FlatList has rendered the new item, otherwise the scroll
    // fires before the item exists and maintainVisibleContentPosition fights it.
    requestAnimationFrame(() => requestAnimationFrame(scrollToBottom));

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
  }, [inputText, currentUserId, id, sending, editingMessage]);

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
      if (gapMs > 60 * 60 * 1000) {
        items.push({ type: 'timestamp', label: formatTimestamp(msg.created_at) });
      }
    }
    return items;
  }, [messages]);

  const renderItem = useCallback(({ item }: { item: ListItem }) => {
    if (item.type === 'timestamp') {
      return (
        <View style={styles.rowClip}>
          <Animated.View style={{ width: '100%', transform: [{ translateX: swipeXClamped }] }}>
            <View style={styles.timestampRow}>
              <ThemedText style={[styles.timestampText, { color: theme.muted }]}>{item.label}</ThemedText>
            </View>
          </Animated.View>
        </View>
      );
    }

    const { msg, isOldestInGroup, isNewestInGroup } = item;
    // In inverted FlatList, marginBottom of a component = visual space ABOVE the item's slot.
    // isOldestInGroup = visual top of group → add inter-group spacing above it.
    const mb = isOldestInGroup ? Spacing.two + 4 : 2;
    const msgTime = new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    if (msg.is_own) {
      const tsBottom = mb + (msg.edited_at && !msg.deleted_at ? EDITED_OFFSET : 0);
      return (
        <View style={styles.rowClip}>
          <Animated.View style={{ width: '100%', transform: [{ translateX: swipeXClamped }] }}>
            <Pressable
              style={[styles.rowOwn, { marginBottom: mb }]}
              onLongPress={(e) => handleLongPress(msg, e.nativeEvent.pageY)}
              delayLongPress={300}
            >
              <View style={styles.ownBubbleGroup}>
                {msg.deleted_at ? (
                  <View style={[styles.bubbleOwn, styles.bubbleDeleted, { borderColor: theme.line }]}>
                    <ThemedText style={[styles.tombstoneText, { color: theme.muted }]}>This message was deleted</ThemedText>
                  </View>
                ) : (
                  <>
                    <View style={[styles.bubbleOwn, { backgroundColor: theme.action }]}>
                      <ThemedText style={styles.bubbleTextOwn}>{msg.body}</ThemedText>
                    </View>
                    {msg.edited_at && (
                      <ThemedText style={[styles.editedLabel, { color: theme.muted }]}>Edited</ThemedText>
                    )}
                  </>
                )}
              </View>
            </Pressable>
            <View style={[styles.msgTimestamp, { bottom: tsBottom }]}>
              <ThemedText style={[styles.msgTimestampText, { color: theme.muted }]}>{msgTime}</ThemedText>
            </View>
          </Animated.View>
        </View>
      );
    }

    const tsTop    = isOldestInGroup ? SENDER_NAME_OFFSET : 0;
    const tsBottom = mb + (msg.edited_at && !msg.deleted_at ? EDITED_OFFSET : 0);
    return (
      <View style={styles.rowClip}>
        <Animated.View style={{ width: '100%', transform: [{ translateX: swipeXClamped }] }}>
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
              {msg.deleted_at ? (
                <View style={[styles.bubbleOther, styles.bubbleDeleted, { borderColor: theme.line }]}>
                  <ThemedText style={[styles.tombstoneText, { color: theme.muted }]}>This message was deleted</ThemedText>
                </View>
              ) : (
                <>
                  <View style={[styles.bubbleOther, { backgroundColor: theme.backgroundElement }]}>
                    <ThemedText style={[styles.bubbleTextOther, { color: theme.ink }]}>{msg.body}</ThemedText>
                  </View>
                  {msg.edited_at && (
                    <ThemedText style={[styles.editedLabel, { color: theme.muted }]}>Edited</ThemedText>
                  )}
                </>
              )}
            </View>
          </View>
          <View style={[styles.msgTimestamp, { top: tsTop, bottom: tsBottom }]}>
            <ThemedText style={[styles.msgTimestampText, { color: theme.muted }]}>{msgTime}</ThemedText>
          </View>
        </Animated.View>
      </View>
    );
  }, [theme, swipeX, handleLongPress]);

  if (loading) return <ChatSkeletonScreen title={title ?? 'Chat'} />;

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
        <View style={styles.flex} {...panResponder.panHandlers}>
          <FlatList
            ref={flatListRef}
            inverted
            keyboardShouldPersistTaps="handled"
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

        {editingMessage && (
          <View style={[styles.editingBanner, { borderTopColor: theme.line, borderBottomColor: theme.line, backgroundColor: theme.backgroundElement }]}>
            <Feather name="edit-2" size={13} color={theme.accent} />
            <ThemedText style={[styles.editingBannerText, { color: theme.ink }]}>Editing message</ThemedText>
            <Pressable onPress={cancelEdit} hitSlop={8}>
              <Feather name="x" size={16} color={theme.muted} />
            </Pressable>
          </View>
        )}

        {isReadOnly ? (
          <View style={[styles.readOnlyBar, { borderTopColor: theme.line, paddingBottom: insets.bottom + Spacing.two }]}>
            <ThemedText style={[styles.readOnlyText, { color: theme.muted }]}>
              Chat closed · the activity has ended
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

      {/* Floating message-options menu — in-tree so the keyboard stays open */}
      {menuMessage && (() => {
        const above  = menuAnchorY > SCREEN_HEIGHT * 0.55;
        const cardPos = above
          ? { bottom: SCREEN_HEIGHT - menuAnchorY + 10, right: Spacing.three }
          : { top: menuAnchorY + 10,                    right: Spacing.three };
        return (
          <View style={[StyleSheet.absoluteFill, styles.menuOverlay]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={dismissMenu} />
            <Animated.View style={[styles.menuCard, cardPos, { transform: [{ scale: menuScale }] }]}>
              {/* Copy */}
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.line }]}
                onPress={() => {
                  Clipboard.setStringAsync(menuMessage.body ?? '');
                  dismissMenu();
                  showToast();
                }}
              >
                <Feather name="copy" size={16} color={theme.ink} />
                <ThemedText style={[styles.menuItemLabel, { color: theme.ink }]}>Copy</ThemedText>
              </Pressable>
              <View style={[styles.menuDivider, { backgroundColor: theme.line }]} />
              {/* Edit */}
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.line }]}
                onPress={() => {
                  setEditingMessage(menuMessage);
                  setInputText(menuMessage.body ?? '');
                  dismissMenu();
                }}
              >
                <Feather name="edit-2" size={16} color={theme.ink} />
                <ThemedText style={[styles.menuItemLabel, { color: theme.ink }]}>Edit</ThemedText>
              </Pressable>
              <View style={[styles.menuDivider, { backgroundColor: theme.line }]} />
              {/* Delete */}
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: theme.line }]}
                onPress={() => {
                  const msg = menuMessage;
                  dismissMenu();
                  setDeletingMessage(msg);
                }}
              >
                <Feather name="trash-2" size={16} color={theme.danger} />
                <ThemedText style={[styles.menuItemLabel, { color: theme.danger }]}>Delete</ThemedText>
              </Pressable>
            </Animated.View>
          </View>
        );
      })()}

      {/* Delete confirmation — in-tree so keyboard stays open */}
      {deletingMessage && (
        <View style={[StyleSheet.absoluteFill, styles.confirmOverlay]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDeletingMessage(null)} />
          <View style={[styles.confirmCard, { backgroundColor: theme.surface }]}>
            <ThemedText style={[styles.confirmTitle, { color: theme.ink }]}>Delete message?</ThemedText>
            <ThemedText style={[styles.confirmBody,  { color: theme.muted }]}>This cannot be undone.</ThemedText>
            <View style={[styles.confirmDivider, { backgroundColor: theme.line }]} />
            <View style={styles.confirmActions}>
              <Pressable
                style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.6 }]}
                onPress={() => setDeletingMessage(null)}
              >
                <ThemedText style={[styles.confirmBtnLabel, { color: theme.ink }]}>Cancel</ThemedText>
              </Pressable>
              <View style={[styles.confirmBtnDivider, { backgroundColor: theme.line }]} />
              <Pressable
                style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.6 }]}
                onPress={async () => {
                  const msg = deletingMessage;
                  setDeletingMessage(null);
                  setMessages(prev => prev.map(m =>
                    m.id === msg.id ? { ...m, body: null, deleted_at: new Date().toISOString() } : m
                  ));
                  const { error } = await supabase.rpc('delete_message', { p_message_id: msg.id });
                  if (error) {
                    setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
                  }
                }}
              >
                <ThemedText style={[styles.confirmBtnLabel, { color: theme.danger }]}>Delete</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* "Copied" toast — drops in from top */}
      <Animated.View
        style={[styles.toast, { top: insets.top + 56, opacity: toastOpacity, transform: [{ translateY: toastTranslateY }] }]}
        pointerEvents="none"
      >
        <ThemedText style={styles.toastText}>Copied</ThemedText>
      </Animated.View>

    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  flex:        { flex: 1 },
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
    paddingTop:    Spacing.three,
    paddingBottom: Spacing.two,
  },

  rowClip: {
    overflow: 'hidden',
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
    alignItems:        'center',
    paddingVertical:    Spacing.two,
    paddingHorizontal:  Spacing.three,
    marginBottom:       2,
  },
  timestampText: {
    fontSize:   12,
    fontWeight: '500',
  },

  rowOwn: {
    flexDirection:     'row',
    justifyContent:    'flex-end',
    paddingHorizontal: Spacing.three,
  },
  ownBubbleGroup: {
    maxWidth:   '75%',
    alignItems: 'flex-end',
    gap:         2,
  },
  bubbleOwn: {
    borderRadius:            18,
    borderBottomRightRadius:  4,
    paddingHorizontal:        Spacing.three,
    paddingVertical:          Spacing.two,
  },
  bubbleTextOwn: {
    color:      '#fff',
    fontSize:   15,
    lineHeight: 21,
  },

  rowOther: {
    flexDirection:     'row',
    alignItems:        'flex-end',
    gap:                Spacing.one + 2,
    paddingHorizontal:  Spacing.three,
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

  msgTimestamp: {
    position:       'absolute',
    right:          -SWIPE_REVEAL,
    top:             0,
    width:           SWIPE_REVEAL,
    justifyContent: 'center',
    alignItems:     'flex-start',
    paddingLeft:     Spacing.two,
  },
  msgTimestampText: {
    fontSize:   11,
    fontWeight: Platform.OS === 'android' ? '400' : '500',
  },

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

  editingBanner: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:                Spacing.one + 2,
    paddingHorizontal:  Spacing.three,
    paddingVertical:    Spacing.one + 4,
    borderTopWidth:     StyleSheet.hairlineWidth,
    borderBottomWidth:  StyleSheet.hairlineWidth,
  },
  editingBannerText: {
    flex:       1,
    fontSize:   13,
    fontWeight: '600',
  },

  bubbleDeleted: {
    backgroundColor: 'transparent',
    borderWidth:      1,
  },
  tombstoneText: {
    fontSize:    14,
    fontStyle:  'italic',
  },
  editedLabel: {
    fontSize:   11,
    fontWeight: '500',
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

  menuOverlay: {
    zIndex: 100,
  },
  menuCard: {
    position:         'absolute',
    width:             MENU_WIDTH,
    borderRadius:      14,
    backgroundColor:  '#FFFFFF',
    shadowColor:      '#000',
    shadowOpacity:     0.14,
    shadowRadius:      16,
    shadowOffset:     { width: 0, height: 6 },
    elevation:         10,
    overflow:         'hidden',
  },
  menuItem: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical:   Spacing.two + 4,
  },
  menuItemLabel: {
    fontSize:   15,
    fontWeight: '500',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
  },

  confirmOverlay: {
    zIndex:          200,
    alignItems:     'center',
    justifyContent: 'center',
  },
  confirmCard: {
    width:        280,
    borderRadius:  16,
    overflow:     'hidden',
    shadowColor:  '#000',
    shadowOpacity: 0.16,
    shadowRadius:  20,
    shadowOffset: { width: 0, height: 8 },
    elevation:     12,
  },
  confirmTitle: {
    fontSize:   16,
    fontWeight: '700',
    textAlign:  'center',
    paddingTop: Spacing.three + 4,
    paddingHorizontal: Spacing.three,
  },
  confirmBody: {
    fontSize:   13,
    textAlign:  'center',
    paddingTop:    Spacing.one + 2,
    paddingBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  confirmDivider: { height: StyleSheet.hairlineWidth },
  confirmActions: {
    flexDirection: 'row',
  },
  confirmBtn: {
    flex:            1,
    alignItems:     'center',
    justifyContent: 'center',
    paddingVertical: Spacing.two + 4,
  },
  confirmBtnLabel: {
    fontSize:   15,
    fontWeight: '500',
  },
  confirmBtnDivider: {
    width: StyleSheet.hairlineWidth,
  },

  toast: {
    position:         'absolute',
    alignSelf:        'center',
    backgroundColor:  'rgba(0,0,0,0.72)',
    borderRadius:      20,
    paddingHorizontal: Spacing.three,
    paddingVertical:   Spacing.two,
  },
  toastText: {
    color:      '#FFFFFF',
    fontSize:   13,
    fontWeight: '600',
  },
});
