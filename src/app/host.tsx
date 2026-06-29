import Slider from '@react-native-community/slider';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RangeSlider } from '@/components/range-slider';
import { TagChip } from '@/components/tag-chip';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { takePickedLocation, type PickedLocation } from '@/lib/location-handoff';
import { supabase } from '@/lib/supabase';
import { TAGS } from '@/lib/tags';

type AcceptMode = 'auto' | 'auto_criteria' | 'manual';

type Criteria = {
  has_photo: boolean;
  min_age:   number;
  max_age:   number;
  genders:   string[];
  within_mi: number | null;
};

const DEFAULT_CRITERIA: Criteria = {
  has_photo: false,
  min_age:   18,
  max_age:   99,
  genders:   [],
  within_mi: null,
};

function isCriteriaEmpty(c: Criteria): boolean {
  return !c.has_photo && c.min_age === 18 && c.max_age === 99 && c.genders.length === 0 && c.within_mi === null;
}

type FormSnapshot = {
  title: string;
  description: string;
  startTime: number;
  timeFlexible: boolean;
  maxParticipants: number;
  mode: AcceptMode;
  tags: string[];
  imageUri: string | null;
  removeExistingImage: boolean;
  criteria: Criteria;
};

const MODES: { value: AcceptMode; label: string }[] = [
  { value: 'auto',          label: 'Everyone'    },
  { value: 'auto_criteria', label: 'Screen'      },
  { value: 'manual',        label: "I'll decide" },
];

const GENDERS: { value: string; label: string; color: string }[] = [
  { value: 'man',        label: 'Men',        color: '#6CA0DC' },
  { value: 'woman',      label: 'Women',      color: '#F8B9D4' },
  { value: 'non_binary', label: 'Non-binary', color: '#B2ACD8' },
];

function defaultStartTime(): Date {
  const d = new Date();
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
  const { id: routeId } = useLocalSearchParams<{ id?: string }>();

  const [activityId,          setActivityId]          = useState<string | null>(routeId ?? null);
  const [loadingActivity,     setLoadingActivity]     = useState(!!routeId);
  const [title,               setTitle]               = useState('');
  const [description,         setDescription]         = useState('');
  const [startTime,           setStartTime]           = useState<Date>(defaultStartTime);
  const [timeFlexible,        setTimeFlexible]        = useState(false);
  const [maxParticipants,     setMaxParticipants]     = useState(4);
  const [mode,                setMode]                = useState<AcceptMode>('auto');
  const [showPicker,          setShowPicker]          = useState(false);
  const [selectedTags,        setSelectedTags]        = useState<string[]>([]);
  const [location,            setLocation]            = useState<PickedLocation | null>(null);
  const [imageUri,            setImageUri]            = useState<string | null>(null);
  const [existingImageUrl,    setExistingImageUrl]    = useState<string | null>(null);
  const [removeExistingImage, setRemoveExistingImage] = useState(false);
  const [submitState,           setSubmitState]           = useState<'idle' | 'submitting' | 'posted' | 'updated'>('idle');
  const [criteria,              setCriteria]              = useState<Criteria>(DEFAULT_CRITERIA);
  const [showDistanceCriterion, setShowDistanceCriterion] = useState(false);

  const savedSnapshot = useRef<FormSnapshot | null>(null);

  useEffect(() => {
    if (!routeId) return;
    (async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('title, description, start_time, time_flexible, max_participants, mode, tags, image_url, criteria')
        .eq('id', routeId)
        .single();
      if (error || !data) { setLoadingActivity(false); return; }

      setTitle(data.title);
      setDescription(data.description ?? '');
      const st = new Date(data.start_time);
      setStartTime(st);
      setTimeFlexible(data.time_flexible);
      setMaxParticipants(data.max_participants);
      setMode(data.mode as AcceptMode);
      setSelectedTags(data.tags ?? []);
      setExistingImageUrl(data.image_url ?? null);
      const loadedCriteria = (data.criteria as Criteria | null) ?? DEFAULT_CRITERIA;
      setCriteria(loadedCriteria);
      setShowDistanceCriterion(loadedCriteria.within_mi !== null);

      savedSnapshot.current = {
        title:               data.title,
        description:         data.description ?? '',
        startTime:           st.getTime(),
        timeFlexible:        data.time_flexible,
        maxParticipants:     data.max_participants,
        mode:                data.mode as AcceptMode,
        tags:                data.tags ?? [],
        imageUri:            null,
        removeExistingImage: false,
        criteria:            loadedCriteria,
      };
      setLoadingActivity(false);
    })();
  }, [routeId]);

  useFocusEffect(useCallback(() => {
    const picked = takePickedLocation();
    if (picked) setLocation(picked);
  }, []));

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;

    const isIOS = Platform.OS === 'ios';
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: !isIOS,
      aspect: [3, 4],
      quality: 1,
    });
    if (result.canceled) return;

    const asset = result.assets[0];
    const { width, height } = asset;

    const targetRatio = 3 / 4;
    const actualRatio = width / height;
    let cropW = width, cropH = height, originX = 0, originY = 0;
    if (actualRatio > targetRatio) {
      cropW = Math.floor(height * targetRatio);
      originX = Math.floor((width - cropW) / 2);
    } else if (actualRatio < targetRatio) {
      cropH = Math.floor(width / targetRatio);
      originY = Math.floor((height - cropH) / 2);
    }

    const imageRef = await ImageManipulator
      .manipulate(asset.uri)
      .crop({ originX, originY, width: cropW, height: cropH })
      .renderAsync();
    const cropped = await imageRef.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
    setImageUri(cropped.uri);
  };

  const toggleTag = (slug: string) => {
    setSelectedTags(prev =>
      prev.includes(slug)
        ? prev.filter(s => s !== slug)
        : prev.length < 3 ? [...prev, slug] : prev
    );
  };

  const snap = savedSnapshot.current;
  const isDirty = snap !== null && (
    title              !== snap.title ||
    description        !== snap.description ||
    startTime.getTime()!== snap.startTime ||
    timeFlexible       !== snap.timeFlexible ||
    maxParticipants    !== snap.maxParticipants ||
    mode               !== snap.mode ||
    JSON.stringify(selectedTags) !== JSON.stringify(snap.tags) ||
    imageUri           !== snap.imageUri ||
    removeExistingImage!== snap.removeExistingImage ||
    JSON.stringify(criteria) !== JSON.stringify(snap.criteria)
  );

  const baseFormValid = title.trim().length > 0 && startTime > new Date();
  const canPost   = !activityId && baseFormValid && location !== null;
  const canUpdate = !!activityId && baseFormValid && isDirty;
  const canAct    = (canPost || canUpdate) && submitState !== 'submitting';

  const showConfirmation = (submitState === 'posted' || submitState === 'updated') && !isDirty;

  const doSubmit = async (finalCriteria: Criteria) => {
    setSubmitState('submitting');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSubmitState('idle'); return; }

      let image_url: string | null | undefined = undefined;
      if (imageUri) {
        const path        = `${user.id}/${Date.now()}.jpg`;
        const fileRes     = await fetch(imageUri);
        const arrayBuffer = await fileRes.arrayBuffer();
        const { error: uploadError } = await supabase.storage
          .from('activity-images')
          .upload(path, arrayBuffer, { contentType: 'image/jpeg' });
        if (uploadError) { console.error(uploadError); setSubmitState('idle'); return; }
        const { data: { publicUrl } } = supabase.storage
          .from('activity-images')
          .getPublicUrl(path);
        image_url = publicUrl;
      } else if (removeExistingImage) {
        image_url = null;
      }

      const criteriaPayload = mode === 'auto_criteria' ? finalCriteria : null;

      if (activityId) {
        const patch: Record<string, unknown> = {
          title:            title.trim(),
          description:      description.trim() || null,
          start_time:       startTime.toISOString(),
          time_flexible:    timeFlexible,
          max_participants: maxParticipants,
          mode,
          tags:             selectedTags,
          criteria:         criteriaPayload,
        };
        if (image_url !== undefined) patch.image_url = image_url;
        if (location) patch.location = `POINT(${location.longitude} ${location.latitude})`;

        const { error } = await supabase.from('activities').update(patch).eq('id', activityId);
        if (error) { console.error(error); setSubmitState('idle'); return; }

        if (image_url !== undefined) setExistingImageUrl(image_url);
        setImageUri(null);
        setRemoveExistingImage(false);
        setLocation(null);
        savedSnapshot.current = {
          title:               title.trim(),
          description:         description.trim(),
          startTime:           startTime.getTime(),
          timeFlexible,
          maxParticipants,
          mode,
          tags:                [...selectedTags],
          imageUri:            null,
          removeExistingImage: false,
          criteria:            finalCriteria,
        };
        setSubmitState('updated');
      } else {
        const { data: newRow, error } = await supabase.from('activities').insert({
          host_id:          user.id,
          title:            title.trim(),
          description:      description.trim() || null,
          start_time:       startTime.toISOString(),
          time_flexible:    timeFlexible,
          max_participants: maxParticipants,
          mode,
          tags:             selectedTags,
          location:         `POINT(${location!.longitude} ${location!.latitude})`,
          image_url:        image_url ?? null,
          criteria:         criteriaPayload,
        }).select('id').single();
        if (error || !newRow) { console.error(error); setSubmitState('idle'); return; }

        setActivityId(newRow.id);
        setImageUri(null);
        setLocation(null);
        savedSnapshot.current = {
          title:               title.trim(),
          description:         description.trim(),
          startTime:           startTime.getTime(),
          timeFlexible,
          maxParticipants,
          mode,
          tags:                [...selectedTags],
          imageUri:            null,
          removeExistingImage: false,
          criteria:            finalCriteria,
        };
        setSubmitState('posted');
      }
    } catch (e) {
      console.error(e);
      setSubmitState('idle');
    }
  };

  const handleSubmit = () => {
    if (!canAct) return;

    // Auto-deselect genders if all 3 selected (= no filter)
    const finalCriteria: Criteria = {
      ...criteria,
      genders: criteria.genders.length === 3 ? [] : criteria.genders,
    };

    if (mode === 'auto_criteria' && isCriteriaEmpty(finalCriteria)) {
      Alert.alert(
        'No screening criteria set',
        'With no criteria, "Screen" works the same as "Everyone". Set at least one criterion or switch to "Everyone".',
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Post anyway', onPress: () => doSubmit(finalCriteria) },
        ],
      );
      return;
    }

    doSubmit(finalCriteria);
  };

  const displayImageUri = imageUri ?? (!removeExistingImage ? existingImageUrl : null);

  if (loadingActivity) {
    return (
      <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
        <View style={[styles.header, { borderBottomColor: theme.line }]}>
          <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
            <ThemedText style={styles.closeBtnText}>✕</ThemedText>
          </Pressable>
          <ThemedText type="smallBold">Edit plan</ThemedText>
          <View style={styles.closeBtn} />
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={theme.action} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.line }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.closeBtn}>
          <ThemedText style={styles.closeBtnText}>✕</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{activityId ? 'Edit plan' : 'Host a plan'}</ThemedText>
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
            autoFocus={!routeId}
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
            onChangeText={t => setDescription(t.replace(/\n/g, ' '))}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={300}
          />
          <ThemedText type="caption" style={[styles.charCount, { color: theme.muted }]}>
            {description.length}/300
          </ThemedText>
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
              accentColor={theme.action}
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
          <View style={[styles.segmented, { backgroundColor: theme.backgroundElement, borderColor: theme.line }]}>
            {(['Exact time', 'Flexible'] as const).map((label, i) => {
              const active = i === 0 ? !timeFlexible : timeFlexible;
              return (
                <Pressable
                  key={label}
                  style={[
                    styles.segment,
                    i === 0 && { borderRightWidth: 1, borderRightColor: theme.line },
                    active && { backgroundColor: theme.surface },
                  ]}
                  onPress={() => setTimeFlexible(i === 1)}>
                  <ThemedText type="label" style={{ color: active ? theme.ink : theme.muted }}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Where */}
        <View style={styles.field}>
          <ThemedText type="label" style={[styles.fieldLabel, { color: theme.ink }]}>
            Where?
          </ThemedText>
          <Pressable
            style={[styles.row, { borderColor: (location || activityId) ? theme.action : theme.line }]}
            onPress={() => router.push(
              location
                ? { pathname: '/location-picker', params: { lat: location.latitude, lng: location.longitude } }
                : '/location-picker'
            )}>
            <ThemedText type="body" style={{ color: (location || activityId) ? theme.ink : theme.muted }}>
              {location
                ? location.label
                : activityId
                  ? 'Location set (tap to change)'
                  : 'Set a rough area…'}
            </ThemedText>
            <ThemedText type="body" style={{ color: theme.muted }}>›</ThemedText>
          </Pressable>
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
                <TagChip
                  key={tag.slug}
                  slug={tag.slug}
                  selected={selected}
                  onPress={() => toggleTag(tag.slug)}
                  disabled={atCap}
                />
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

        {/* Screening criteria — only when Screen mode is selected */}
        {mode === 'auto_criteria' && (
          <View style={[styles.criteriaCard, { backgroundColor: theme.backgroundElement, borderColor: theme.line }]}>
            <ThemedText type="label" style={[styles.fieldLabel, { color: theme.ink }]}>
              Screening criteria
            </ThemedText>

            {/* Has photo */}
            <View style={styles.criteriaRow}>
              <ThemedText type="body" style={{ color: theme.ink }}>Profile photo required</ThemedText>
              <Switch
                value={criteria.has_photo}
                onValueChange={v => setCriteria(c => ({ ...c, has_photo: v }))}
                trackColor={{ false: theme.line, true: theme.accent }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Age range */}
            <View style={styles.criteriaSub}>
              <View style={styles.criteriaRowSpread}>
                <ThemedText type="label" style={{ color: theme.ink }}>Age range</ThemedText>
                <ThemedText type="label" style={{ color: theme.accent }}>
                  {criteria.min_age} – {criteria.max_age}
                </ThemedText>
              </View>
              <RangeSlider
                min={18}
                max={99}
                low={criteria.min_age}
                high={criteria.max_age}
                onChange={(lo, hi) => setCriteria(c => ({ ...c, min_age: lo, max_age: hi }))}
                fillColor={theme.accent}
                trackColor={theme.line}
              />
              <View style={styles.sliderLabels}>
                <ThemedText type="caption" style={{ color: theme.muted }}>18</ThemedText>
                <ThemedText type="caption" style={{ color: theme.muted }}>99</ThemedText>
              </View>
            </View>

            {/* Gender */}
            <View style={styles.criteriaSub}>
              <ThemedText type="label" style={{ color: theme.ink }}>Gender</ThemedText>
              <View style={styles.genderRow}>
                {GENDERS.map(g => {
                  const selected = criteria.genders.includes(g.value);
                  return (
                    <Pressable
                      key={g.value}
                      style={[
                        styles.genderChip,
                        {
                          borderColor:     selected ? g.color : theme.line,
                          backgroundColor: selected ? g.color + '33' : 'transparent',
                        },
                      ]}
                      onPress={() => setCriteria(c => ({
                        ...c,
                        genders: selected
                          ? c.genders.filter(x => x !== g.value)
                          : [...c.genders, g.value],
                      }))}>
                      <ThemedText style={[styles.genderChipText, { color: selected ? g.color : theme.muted }]}>
                        {g.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Within X mi */}
            <View style={styles.criteriaSub}>
              <View style={styles.criteriaRow}>
                <ThemedText type="label" style={{ color: theme.ink }}>Within a distance</ThemedText>
                <Switch
                  value={showDistanceCriterion}
                  onValueChange={v => {
                    setShowDistanceCriterion(v);
                    setCriteria(c => ({ ...c, within_mi: v ? (c.within_mi ?? 25) : null }));
                  }}
                  trackColor={{ false: theme.line, true: theme.accent }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {showDistanceCriterion && (
                <>
                  <View style={[styles.criteriaRowSpread, { marginTop: Spacing.one }]}>
                    <ThemedText type="caption" style={{ color: theme.muted }}>From activity location</ThemedText>
                    <ThemedText type="label" style={{ color: theme.accent }}>{criteria.within_mi} mi</ThemedText>
                  </View>
                  <Slider
                    style={styles.slider}
                    minimumValue={1}
                    maximumValue={100}
                    step={1}
                    value={criteria.within_mi ?? 25}
                    onValueChange={v => setCriteria(c => ({ ...c, within_mi: v }))}
                    minimumTrackTintColor={theme.accent}
                    maximumTrackTintColor={theme.line}
                    thumbTintColor={theme.accent}
                  />
                  <View style={styles.sliderLabels}>
                    <ThemedText type="caption" style={{ color: theme.muted }}>1 mi</ThemedText>
                    <ThemedText type="caption" style={{ color: theme.muted }}>100 mi</ThemedText>
                  </View>
                </>
              )}
            </View>
          </View>
        )}

        {/* Photo */}
        <View style={styles.field}>
          <ThemedText type="label" style={[styles.fieldLabel, { color: theme.ink }]}>
            Photo{' '}
            <ThemedText type="caption" style={{ color: theme.muted }}>(optional)</ThemedText>
          </ThemedText>
          {displayImageUri ? (
            <View style={styles.imagePreviewWrap}>
              <Image source={{ uri: displayImageUri }} style={styles.imagePreview} contentFit="cover" />
              <Pressable
                style={[styles.imageRemove, { backgroundColor: theme.bg }]}
                onPress={() => {
                  if (imageUri) setImageUri(null);
                  else setRemoveExistingImage(true);
                }}
                hitSlop={8}>
                <ThemedText style={[styles.imageRemoveText, { color: theme.ink }]}>✕</ThemedText>
              </Pressable>
            </View>
          ) : (
            <Pressable
              style={[styles.imagePlaceholder, { borderColor: theme.line, backgroundColor: theme.surface }]}
              onPress={pickImage}>
              <ThemedText type="caption" style={{ color: theme.muted }}>+ Add photo</ThemedText>
            </Pressable>
          )}
        </View>

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <ThemedText type="caption" style={{ color: theme.muted }}>
            🔒 The exact meet spot is shared in the group chat after people join.
          </ThemedText>
        </View>

        {/* Submit CTA */}
        <Pressable
          style={[styles.cta, {
            backgroundColor:
              showConfirmation ? theme.accent :
              canAct           ? theme.action : theme.line,
          }]}
          onPress={handleSubmit}
          disabled={!canAct}>
          {submitState === 'submitting'
            ? <ActivityIndicator color="#FFFFFF" />
            : <ThemedText type="label" style={styles.ctaText}>
                {showConfirmation
                  ? (submitState === 'posted' ? 'Posted! ✓' : 'Updated! ✓')
                  : activityId ? 'Update' : 'Post it ✦'}
              </ThemedText>
          }
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
  charCount: {
    marginTop: 4,
    textAlign: 'right',
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
  stepBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { lineHeight: 28 },
  stepValue:   { minWidth: 40, textAlign: 'center' },

  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
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

  imagePlaceholder: {
    height: 120,
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePreviewWrap: {
    position: 'relative',
    alignSelf: 'flex-start',
  },
  imagePreview: {
    width: 120,
    height: 160,
    borderRadius: 12,
  },
  imageRemove: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageRemoveText: { fontSize: 11, fontWeight: '700' },

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

  criteriaCard: {
    borderWidth:  1,
    borderRadius: 12,
    padding:      Spacing.three,
    gap:          Spacing.three,
    marginBottom: Spacing.three,
  },
  criteriaRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  criteriaRowSpread: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
    marginBottom:   Spacing.one,
  },
  criteriaSub: {
    gap: Spacing.one + 2,
  },
  sliderLabels: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginTop:      2,
  },
  slider: { width: '100%', height: 40 },
  genderRow: {
    flexDirection: 'row',
    gap:            8,
    marginTop:      Spacing.one,
  },
  genderChip: {
    flex:              1,
    paddingVertical:   8,
    borderRadius:      20,
    borderWidth:       1,
    alignItems:        'center',
  },
  genderChipText: {
    fontSize:   13,
    fontWeight: '700',
  },
});
