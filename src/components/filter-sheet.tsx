import Slider from '@react-native-community/slider';
import { useRouter } from 'expo-router';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { type PickedLocation } from '@/lib/location-handoff';
import { TAGS, tagColor } from '@/lib/tags';

export type Filters = {
  radiusMi: number;
  tags: string[];
  center: PickedLocation | null;
};

export const DEFAULT_FILTERS: Filters = {
  radiusMi: 10,
  tags: [],
  center: null,
};

function filtersEqual(a: Filters, b: Filters): boolean {
  return (
    a.radiusMi === b.radiusMi &&
    a.tags.length === b.tags.length &&
    a.tags.every(t => b.tags.includes(t)) &&
    a.center?.latitude  === b.center?.latitude &&
    a.center?.longitude === b.center?.longitude
  );
}

type Props = {
  visible: boolean;
  filters: Filters;
  appliedFilters: Filters;
  onChange: (f: Filters) => void;
  onClose: () => void;
  onApply: () => void;
  onBeforeLocationPicker?: () => void;
};

export function FilterSheet({ visible, filters, appliedFilters, onChange, onClose, onApply, onBeforeLocationPicker }: Props) {
  const theme  = Colors.light;
  const { bottom } = useSafeAreaInsets();
  const router = useRouter();

  const hasChanged = !filtersEqual(filters, appliedFilters);

  function toggleTag(slug: string) {
    const next = filters.tags.includes(slug)
      ? filters.tags.filter(t => t !== slug)
      : [...filters.tags, slug];
    onChange({ ...filters, tags: next });
  }

  function reset() {
    onChange({ ...DEFAULT_FILTERS, center: filters.center });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={[styles.sheet, { backgroundColor: theme.bg, paddingBottom: bottom + Spacing.three }]}>
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: theme.line }]} />

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

          {/* Location */}
          <ThemedText type="label" style={[styles.sectionLabel, { color: theme.muted }]}>Location</ThemedText>
          <Pressable
            style={[styles.locationRow, { backgroundColor: theme.surface, borderColor: theme.line }]}
            onPress={() => {
              onBeforeLocationPicker?.();
              router.push(
                filters.center
                  ? { pathname: '/location-picker', params: { lat: filters.center.latitude, lng: filters.center.longitude } }
                  : '/location-picker'
              );
            }}
          >
            <ThemedText type="caption" style={{ color: theme.muted }}>📍 </ThemedText>
            <ThemedText type="caption" style={{ color: theme.ink, fontWeight: '600', flex: 1 }} numberOfLines={1}>
              {filters.center ? filters.center.label : 'Current location'}
            </ThemedText>
            <ThemedText type="caption" style={{ color: theme.muted }}>Change</ThemedText>
          </Pressable>

          {/* Distance */}
          <View style={styles.sectionRow}>
            <ThemedText type="label" style={[styles.sectionLabel, { color: theme.muted }]}>Distance</ThemedText>
            <ThemedText type="label" style={{ color: theme.action, fontWeight: '700' }}>
              {filters.radiusMi} mi
            </ThemedText>
          </View>
          <Slider
            style={styles.slider}
            minimumValue={1}
            maximumValue={100}
            step={1}
            value={filters.radiusMi}
            onValueChange={v => onChange({ ...filters, radiusMi: v })}
            minimumTrackTintColor={theme.action}
            maximumTrackTintColor={theme.line}
            thumbTintColor={theme.action}
          />
          <View style={styles.sliderLabels}>
            <ThemedText type="caption" style={{ color: theme.muted }}>1 mi</ThemedText>
            <ThemedText type="caption" style={{ color: theme.muted }}>100 mi</ThemedText>
          </View>

          {/* Tags */}
          <ThemedText type="label" style={[styles.sectionLabel, { color: theme.muted, marginTop: Spacing.three }]}>
            Tags
          </ThemedText>
          <View style={styles.tagGrid}>
            {TAGS.map(tag => {
              const active = filters.tags.includes(tag.slug);
              return (
                <Pressable
                  key={tag.slug}
                  onPress={() => toggleTag(tag.slug)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? tagColor(tag.slug) + '25' : theme.surface,
                      borderColor:     active ? tagColor(tag.slug) : theme.line,
                    },
                  ]}
                >
                  <ThemedText
                    type="caption"
                    style={{ color: active ? tagColor(tag.slug) : theme.muted, fontWeight: '600' }}
                  >
                    {tag.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: theme.line }]}>
          <Pressable onPress={reset} style={styles.resetBtn}>
            <ThemedText type="label" style={{ color: theme.muted }}>Reset</ThemedText>
          </Pressable>
          <Pressable
            style={[styles.applyBtn, { backgroundColor: hasChanged ? theme.action : theme.line }]}
            onPress={hasChanged ? onApply : undefined}
          >
            <ThemedText type="label" style={{ color: hasChanged ? '#fff' : theme.muted }}>Apply</ThemedText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  content: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },

  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionLabel: {
    textTransform: 'uppercase',
    fontSize: 11,
    letterSpacing: 0.8,
    marginBottom: Spacing.two,
  },

  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.three,
    gap: 4,
  },

  slider: { width: '100%', height: 40 },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -Spacing.one,
  },

  tagGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
  },

  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  resetBtn: { paddingVertical: Spacing.two, paddingHorizontal: Spacing.two },
  applyBtn: {
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
});
