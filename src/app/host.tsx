import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
type AcceptMode = 'auto' | 'auto_criteria' | 'manual';

const TAGS: { slug: string; label: string; color: string }[] = [
  { slug: 'arts',       label: 'Arts & culture', color: '#B45C8A' },
  { slug: 'fitness',    label: 'Fitness',         color: '#1E9E8E' },
  { slug: 'food_drink', label: 'Food & drink',    color: '#F4845F' },
  { slug: 'games',      label: 'Games',           color: '#4F46E5' },
  { slug: 'learning',   label: 'Learning',        color: '#3B82F6' },
  { slug: 'music',      label: 'Music',           color: '#7C3AED' },
  { slug: 'nightlife',  label: 'Nightlife',       color: '#DB2777' },
  { slug: 'outdoors',   label: 'Outdoors',        color: '#2AAFA8' },
  { slug: 'social',     label: 'Social',          color: '#D97706' },
  { slug: 'sports',     label: 'Sports',          color: '#C2520A' },
];

const MODES: { value: AcceptMode; label: string }[] = [
  { value: 'auto',          label: 'Everyone'  },
  { value: 'auto_criteria', label: 'Screen'    },
  { value: 'manual',        label: "I'll decide" },
];

function defaultStartTime(): Date {
  const d = new Date();
  // Snap to next 30-min boundary at least 30 min from now
  const mins = d.getMinutes();
  d.setMinutes(mins < 30 ? 30 : 60, 0, 0);
  if (d.getTime() - Date.now() < 30 * 60 * 1000) d.setHours(d.getHours() + 1, 0, 0, 0);
  return d;
}

function formatDateTime(date: Date): string {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === now.toDateString())      return `Today, ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow, ${time}`;
  const day = date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day}, ${time}`;
}

export default function HostScreen() {
  const router = useRouter();
  const theme = Colors.light;

  const [title,           setTitle]           = useState('');
  const [description,     setDescription]     = useState('');
  const [startTime,       setStartTime]       = useState<Date>(defaultStartTime);
  const [timeFlexible,    setTimeFlexible]    = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(4);
  const [mode,            setMode]            = useState<AcceptMode>('auto');
  const [showPicker,      setShowPicker]      = useState(false);
  const [selectedTags,    setSelectedTags]    = useState<string[]>([]);

  const toggleTag = (slug: string) => {
    setSelectedTags(prev =>
      prev.includes(slug)
        ? prev.filter(s => s !== slug)
        : prev.length < 3 ? [...prev, slug] : prev
    );
  };

  const canSubmit = title.trim().length > 0 && startTime > new Date();

  const handleSubmit = () => {
    if (!canSubmit) return;
    // TODO Phase 2c: insert activity row to DB
    router.back();
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
          <ThemedText style={styles.closeBtnText}>✕</ThemedText>
        </Pressable>
        <ThemedText type="title">Host a plan</ThemedText>
        <View style={styles.closeBtn} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Title */}
        <View style={styles.field}>
          <ThemedText type="label" style={[styles.fieldLabel, { color: theme.ink }]}>
            What are we doing?
          </ThemedText>
          <TextInput
            style={[styles.input, { color: theme.ink, borderColor: theme.line }]}
            placeholder="e.g. Sunset hike"
            placeholderTextColor={theme.muted}
            value={title}
            onChangeText={setTitle}
            returnKeyType="next"
            autoFocus
          />
        </View>

        {/* Description */}
        <View style={styles.field}>
          <ThemedText type="label" style={[styles.fieldLabel, { color: theme.ink }]}>
            Any details?{' '}
            <ThemedText type="caption" style={{ color: theme.muted }}>(optional)</ThemedText>
          </ThemedText>
          <TextInput
            style={[styles.input, styles.inputMultiline, { color: theme.ink, borderColor: theme.line }]}
            placeholder="Meet at the east entrance, bring water…"
            placeholderTextColor={theme.muted}
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* When */}
        <View style={styles.field}>
          <ThemedText type="label" style={[styles.fieldLabel, { color: theme.ink }]}>
            When?
          </ThemedText>
          <Pressable
            style={[styles.row, { borderColor: theme.line }]}
            onPress={() => setShowPicker(v => !v)}>
            <ThemedText type="body">{formatDateTime(startTime)}</ThemedText>
            <ThemedText type="body" style={{ color: theme.muted }}>›</ThemedText>
          </Pressable>
          {showPicker && (
            <DateTimePicker
              value={startTime}
              mode="datetime"
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              minimumDate={new Date()}
              onChange={(_, date) => {
                if (date) setStartTime(date);
                if (Platform.OS === 'android') setShowPicker(false);
              }}
              style={{ marginTop: Spacing.two }}
            />
          )}
        </View>

        {/* Vibe (time_flexible) */}
        <View style={styles.field}>
          <ThemedText type="label" style={[styles.fieldLabel, { color: theme.ink }]}>
            Vibe
          </ThemedText>
          <Pressable
            style={[styles.row, { borderColor: theme.line }]}
            onPress={() => setTimeFlexible(v => !v)}>
            <View style={styles.rowLeft}>
              <ThemedText type="body">🗓</ThemedText>
              <ThemedText type="body">{timeFlexible ? 'Flexible' : 'Exact time'}</ThemedText>
            </View>
            <ThemedText type="body" style={{ color: theme.muted }}>›</ThemedText>
          </Pressable>
        </View>

        {/* Where — location stub, filled in Phase 2c */}
        <View style={styles.field}>
          <ThemedText type="label" style={[styles.fieldLabel, { color: theme.ink }]}>
            Where?
          </ThemedText>
          <View style={[styles.row, { borderColor: theme.line, opacity: 0.45 }]}>
            <ThemedText type="body" style={{ color: theme.muted }}>Around you (~2 mi)</ThemedText>
            <ThemedText type="body" style={{ color: theme.muted }}>✦</ThemedText>
          </View>
        </View>

        {/* How many people */}
        <View style={styles.field}>
          <ThemedText type="label" style={[styles.fieldLabel, { color: theme.ink }]}>
            How many people?
          </ThemedText>
          <View style={[styles.row, { borderColor: theme.line }]}>
            <Pressable
              onPress={() => setMaxParticipants(p => Math.max(2, p - 1))}
              hitSlop={12}
              disabled={maxParticipants === 2}
              style={styles.stepBtn}>
              <ThemedText type="title" style={[styles.stepBtnText, { color: maxParticipants === 2 ? theme.muted : theme.ink, fontWeight: maxParticipants === 2 ? '400' : '600' }]}>−</ThemedText>
            </Pressable>
            <ThemedText type="title" style={styles.stepValue}>{maxParticipants}</ThemedText>
            <Pressable
              onPress={() => setMaxParticipants(p => Math.min(25, p + 1))}
              hitSlop={12}
              disabled={maxParticipants === 25}
              style={styles.stepBtn}>
              <ThemedText type="title" style={[styles.stepBtnText, { color: maxParticipants === 25 ? theme.muted : theme.ink, fontWeight: maxParticipants === 25 ? '400' : '600' }]}>+</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Tags */}
        <View style={styles.field}>
          <ThemedText type="label" style={[styles.fieldLabel, { color: theme.ink }]}>
            Tags{' '}
            <ThemedText type="caption" style={{ color: theme.muted }}>(up to 3, optional)</ThemedText>
          </ThemedText>
          <View style={styles.chipGrid}>
            {TAGS.map(tag => {
              const selected = selectedTags.includes(tag.slug);
              const atCap    = !selected && selectedTags.length >= 3;
              return (
                <Pressable
                  key={tag.slug}
                  onPress={() => toggleTag(tag.slug)}
                  disabled={atCap}
                  style={[
                    styles.chip,
                    selected
                      ? { backgroundColor: tag.color + '22', borderColor: tag.color + '55' }
                      : { backgroundColor: theme.surface, borderColor: theme.line },
                    atCap && styles.chipDimmed,
                  ]}>
                  <ThemedText
                    type="label"
                    style={{ color: selected ? tag.color : atCap ? theme.muted : theme.ink, fontWeight: '600' }}>
                    {tag.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Who can join — segmented control */}
        <View style={styles.field}>
          <ThemedText type="label" style={[styles.fieldLabel, { color: theme.ink }]}>
            Who can join?
          </ThemedText>
          <View style={[styles.segmented, { backgroundColor: theme.backgroundElement, borderColor: theme.line }]}>
            {MODES.map((m, i) => (
              <Pressable
                key={m.value}
                style={[
                  styles.segment,
                  i < MODES.length - 1 && { borderRightWidth: 1, borderRightColor: theme.line },
                  mode === m.value && { backgroundColor: theme.surface },
                ]}
                onPress={() => setMode(m.value)}>
                <ThemedText
                  type="label"
                  style={{ color: mode === m.value ? theme.ink : theme.muted }}>
                  {m.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <ThemedText type="caption" style={{ color: theme.muted }}>
            🔒 The exact meet spot is shared in the group chat after people join.
          </ThemedText>
        </View>

        {/* Post it CTA */}
        <Pressable
          style={[styles.cta, { backgroundColor: canSubmit ? theme.action : theme.line }]}
          onPress={handleSubmit}
          disabled={!canSubmit}>
          <ThemedText type="label" style={styles.ctaText}>Post it ✦</ThemedText>
        </Pressable>

        <View style={{ height: Spacing.four }} />
      </ScrollView>
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
  closeBtn:     { width: 32, alignItems: 'center' },
  closeBtnText: { fontSize: 18, lineHeight: 24 },

  scroll: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three },

  field:      { marginBottom: Spacing.three },
  fieldLabel: { marginBottom: Spacing.one + 2 },

  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  inputMultiline: {
    minHeight: 80,
    paddingTop: Spacing.two + 2,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 4,
  },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  stepBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { lineHeight: 28 },
  stepValue:   { minWidth: 40, textAlign: 'center' },

  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.two + 4,
    paddingVertical: Spacing.one + 2,
  },
  chipDimmed: {
    opacity: 0.4,
  },

  segmented: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  segment: {
    flex: 1,
    paddingVertical: Spacing.two + 2,
    alignItems: 'center',
  },

  privacyNote: {
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.one,
  },

  cta: {
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
