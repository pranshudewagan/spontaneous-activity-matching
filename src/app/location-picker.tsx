import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import MapView, { Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { setPickedLocation } from '@/lib/location-handoff';

const STATE_ABBR: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC',
};

const DEFAULT_REGION: Region = {
  latitude: 40.7128,
  longitude: -74.006,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

type Suggestion = {
  id: string;
  primary: string;
  secondary: string;
  latitude: number;
  longitude: number;
};

export default function LocationPickerScreen() {
  const router   = useRouter();
  const insets   = useSafeAreaInsets();
  const theme    = Colors.light;
  const mapRef   = useRef<MapView>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { lat, lng } = useLocalSearchParams<{ lat?: string; lng?: string }>();
  const existingRegion: Region | null = lat && lng
    ? { latitude: parseFloat(lat), longitude: parseFloat(lng), latitudeDelta: 0.02, longitudeDelta: 0.02 }
    : null;

  const [region,       setRegion]       = useState<Region>(existingRegion ?? DEFAULT_REGION);
  const [isMoving,     setIsMoving]     = useState(false);
  const [areaLabel,    setAreaLabel]    = useState('');
  const [searchText,   setSearchText]   = useState('');
  const [suggestions,  setSuggestions]  = useState<Suggestion[]>([]);
  const [isFetching,   setIsFetching]   = useState(false);
  const [locating,     setLocating]     = useState(false);

  const pinLift    = useRef(new Animated.Value(0)).current;
  const shadowScl  = useRef(new Animated.Value(1)).current;

  // Pin lift/drop animation
  useEffect(() => {
    Animated.parallel([
      Animated.spring(pinLift,   { toValue: isMoving ? -14 : 0,   useNativeDriver: true, tension: 220, friction: 14 }),
      Animated.spring(shadowScl, { toValue: isMoving ? 0.55 : 1,  useNativeDriver: true, tension: 220, friction: 14 }),
    ]).start();
  }, [isMoving]);

  // Fly to current location
  const flyToCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const r: Region = {
        latitude:       loc.coords.latitude,
        longitude:      loc.coords.longitude,
        latitudeDelta:  0.02,
        longitudeDelta: 0.02,
      };
      setRegion(r);
      mapRef.current?.animateToRegion(r, 600);
      doReverseGeocode(loc.coords.latitude, loc.coords.longitude);
    } finally {
      setLocating(false);
    }
  };

  // On mount: restore previously-set location, or default to current location
  useEffect(() => {
    if (existingRegion) {
      mapRef.current?.animateToRegion(existingRegion, 0);
      doReverseGeocode(existingRegion.latitude, existingRegion.longitude);
    } else {
      flyToCurrentLocation();
    }
  }, []);

  const doReverseGeocode = async (lat: number, lng: number) => {
    try {
      const [r] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (!r) return;
      const neighborhood = r.district ?? null;
      const city         = r.city ?? null;
      const state        = r.region ? (STATE_ABBR[r.region] ?? r.region) : null;
      const label = [neighborhood, city, state].filter(Boolean).join(', ');
      setAreaLabel(label || 'Selected area');
    } catch {
      setAreaLabel('Selected area');
    }
  };

  // Autocomplete via Nominatim (free, no API key)
  const handleSearchChange = (text: string) => {
    setSearchText(text);
    if (debounce.current) clearTimeout(debounce.current);
    if (text.trim().length < 2) { setSuggestions([]); return; }

    // Don't fire when the last word is a single character — a lone letter
    // confuses Nominatim and replaces good results with irrelevant ones.
    const words = text.trim().split(/\s+/);
    if (words[words.length - 1].length < 2) return;

    debounce.current = setTimeout(async () => {
      setIsFetching(true);
      try {
        const res  = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(text)}&format=json&limit=5&addressdetails=1&countrycodes=us`,
          { headers: { 'User-Agent': 'spontaneous-activity-matching/1.0' } },
        );
        const data = await res.json();
        // Only replace suggestions if we actually got results — keeps stale list
        // visible while the user is mid-word rather than flashing empty.
        if (data.length > 0) {
          setSuggestions(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data.map((item: any) => {
              const addr    = item.address ?? {};
              const street  = [addr.house_number, addr.road].filter(Boolean).join(' ');
              const named   = addr.amenity ?? addr.shop ?? addr.tourism ?? addr.leisure ?? addr.building ?? '';
              const primary = named || street || (item.display_name as string).split(',')[0].trim();
              const city    = addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? '';
              const state   = addr.state ?? '';
              const secondary = [street || null, city, state].filter(Boolean).join(', ');
              return {
                id: String(item.place_id),
                primary,
                secondary,
                latitude:  parseFloat(item.lat),
                longitude: parseFloat(item.lon),
              };
            }),
          );
        }
      } catch {
        // Keep stale suggestions on network error rather than blanking the list.
      } finally {
        setIsFetching(false);
      }
    }, 350);
  };

  const handleSelectSuggestion = (s: Suggestion) => {
    setSearchText(s.primary);
    setSuggestions([]);
    Keyboard.dismiss();
    mapRef.current?.animateToRegion(
      { latitude: s.latitude, longitude: s.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
      600,
    );
  };

  const handleConfirm = () => {
    setPickedLocation({ latitude: region.latitude, longitude: region.longitude, label: areaLabel });
    router.back();
  };

  const headerTop = insets.top + Spacing.two;

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={DEFAULT_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChange={() => setIsMoving(true)}
        onRegionChangeComplete={(r) => {
          setIsMoving(false);
          setRegion(r);
          doReverseGeocode(r.latitude, r.longitude);
        }}
      />

      {/* Fixed pin */}
      <View style={styles.pinAnchor} pointerEvents="none">
        <Animated.View style={[styles.pinShadow, { transform: [{ scale: shadowScl }] }]} />
        <Animated.View style={[styles.pin, { transform: [{ translateY: pinLift }] }]}>
          <View style={[styles.pinHead, { backgroundColor: theme.action }]} />
          <View style={[styles.pinTip,  { borderTopColor: theme.action   }]} />
        </Animated.View>
      </View>

      {/* Floating header: close + search */}
      <View style={[styles.header, { top: headerTop }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.closeBtn, { backgroundColor: theme.surface }]}>
          <ThemedText style={styles.closeBtnText}>✕</ThemedText>
        </Pressable>
        <View style={[styles.searchBar, { backgroundColor: theme.surface }]}>
          <TextInput
            style={[styles.searchInput, { color: theme.ink }]}
            placeholder="Search a place or address…"
            placeholderTextColor={theme.muted}
            value={searchText}
            onChangeText={handleSearchChange}
            returnKeyType="search"
            onSubmitEditing={() => { setSuggestions([]); Keyboard.dismiss(); }}
          />
          {isFetching && <ActivityIndicator size="small" color={theme.muted} style={{ marginRight: 4 }} />}
        </View>
      </View>

      {/* Autocomplete suggestions */}
      {suggestions.length > 0 && (
        <View style={[styles.suggestionsContainer, { top: headerTop + 48 + Spacing.two, backgroundColor: theme.surface }]}>
          <ScrollView keyboardShouldPersistTaps="handled" bounces={false}>
            {suggestions.map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => handleSelectSuggestion(s)}
                style={[
                  styles.suggestionRow,
                  i < suggestions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
                ]}>
                <MaterialIcons name="place" size={18} color={theme.muted} style={{ marginTop: 1 }} />
                <View style={{ flex: 1 }}>
                  <ThemedText type="label" style={{ color: theme.ink }} numberOfLines={1}>{s.primary}</ThemedText>
                  {s.secondary ? (
                    <ThemedText type="caption" style={{ color: theme.muted }} numberOfLines={1}>{s.secondary}</ThemedText>
                  ) : null}
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Current location button */}
      <Pressable
        onPress={flyToCurrentLocation}
        style={[styles.locateBtn, { top: headerTop + 48 + Spacing.two, backgroundColor: theme.action }]}>
        {locating
          ? <ActivityIndicator size="small" color="#FFFFFF" />
          : <MaterialIcons name="my-location" size={22} color="#FFFFFF" />
        }
      </Pressable>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.two, backgroundColor: theme.surface }]}>
        <ThemedText type="caption" style={[styles.areaLabel, { color: theme.muted }]} numberOfLines={1}>
          {areaLabel || 'Move the map to set a rough area'}
        </ThemedText>
        <Pressable style={[styles.cta, { backgroundColor: theme.action }]} onPress={handleConfirm}>
          <ThemedText type="label" style={styles.ctaText}>Set location</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const PIN_HEAD = 22;

const styles = StyleSheet.create({
  root: { flex: 1 },

  pinAnchor: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  pin:       { alignItems: 'center' },
  pinHead: {
    width: PIN_HEAD, height: PIN_HEAD, borderRadius: PIN_HEAD / 2,
    shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  pinTip: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },
  pinShadow: {
    position: 'absolute', bottom: -4,
    width: 14, height: 6, borderRadius: 3, backgroundColor: '#00000030',
  },

  header: {
    position: 'absolute', left: Spacing.three, right: Spacing.three,
    flexDirection: 'row', alignItems: 'center', gap: Spacing.two,
  },
  closeBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  closeBtnText: { fontSize: 16 },
  searchBar: {
    flex: 1, height: 40, borderRadius: 20,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.two + 4, gap: Spacing.two,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  searchInput: { flex: 1, fontSize: 15 },

  suggestionsContainer: {
    position: 'absolute', left: Spacing.three, right: Spacing.three,
    borderRadius: 14, maxHeight: 240,
    shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
    overflow: 'hidden',
  },
  suggestionRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: Spacing.two + 4, paddingVertical: Spacing.two + 2,
    gap: Spacing.two,
  },

  locateBtn: {
    position: 'absolute', right: Spacing.three,
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.three, paddingTop: Spacing.three,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: -4 }, elevation: 8,
  },
  areaLabel: { textAlign: 'center', marginBottom: Spacing.two },
  cta: { borderRadius: 14, paddingVertical: Spacing.three, alignItems: 'center' },
  ctaText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },
});
