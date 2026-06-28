import { useRouter } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Circle, ClipPath, Defs, Ellipse, Path, Rect, Svg } from 'react-native-svg';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

const CIRCLE = 220;

function SunsetIllustration() {
  const r = CIRCLE / 2;
  return (
    <Svg width={CIRCLE} height={CIRCLE} viewBox="0 0 220 220">
      <Defs>
        <ClipPath id="circle">
          <Circle cx={r} cy={r} r={r} />
        </ClipPath>
      </Defs>

      {/* Sky */}
      <Rect x={0} y={0} width={220} height={220} fill="#F9D9C0" clipPath="url(#circle)" />

      {/* Sun glow */}
      <Circle cx={110} cy={112} r={42} fill="#F7C49A" clipPath="url(#circle)" />
      {/* Sun disc */}
      <Circle cx={110} cy={112} r={26} fill="#F4A06A" clipPath="url(#circle)" />

      {/* Far mountains */}
      <Path
        d="M0 148 L40 108 L70 130 L100 98 L130 122 L160 100 L190 118 L220 106 L220 165 L0 165 Z"
        fill="#C8A882"
        clipPath="url(#circle)"
      />
      {/* Near mountains */}
      <Path
        d="M0 162 L35 128 L62 148 L90 118 L118 142 L148 120 L175 140 L220 122 L220 175 L0 175 Z"
        fill="#A07D5A"
        clipPath="url(#circle)"
      />

      {/* Water */}
      <Rect x={0} y={155} width={220} height={65} fill="#9AC8C2" clipPath="url(#circle)" />

      {/* Water shimmer lines */}
      <Path d="M55 165 Q80 162 105 165" stroke="#C8E8E4" strokeWidth={2} fill="none" clipPath="url(#circle)" />
      <Path d="M90 172 Q120 168 150 172" stroke="#C8E8E4" strokeWidth={1.5} fill="none" clipPath="url(#circle)" />
      <Path d="M40 180 Q75 176 110 180" stroke="#C8E8E4" strokeWidth={1.5} fill="none" clipPath="url(#circle)" />
      {/* Sun reflection */}
      <Ellipse cx={110} cy={168} rx={12} ry={6} fill="#F4C08A" opacity={0.7} clipPath="url(#circle)" />

      {/* Left tropical leaves */}
      <Path
        d="M-10 220 Q10 160 30 140 Q20 170 15 200 Z"
        fill="#4A7A55"
        clipPath="url(#circle)"
      />
      <Path
        d="M-5 220 Q25 155 50 130 Q30 165 22 205 Z"
        fill="#3D6B47"
        clipPath="url(#circle)"
      />
      <Path
        d="M5 220 Q15 175 8 148 Q22 175 18 210 Z"
        fill="#5A8A65"
        clipPath="url(#circle)"
      />

      {/* Right tropical leaves */}
      <Path
        d="M230 220 Q210 160 190 140 Q200 170 205 200 Z"
        fill="#4A7A55"
        clipPath="url(#circle)"
      />
      <Path
        d="M225 220 Q195 155 170 130 Q190 165 198 205 Z"
        fill="#3D6B47"
        clipPath="url(#circle)"
      />
      <Path
        d="M215 220 Q205 175 212 148 Q198 175 202 210 Z"
        fill="#5A8A65"
        clipPath="url(#circle)"
      />

      {/* Birds */}
      <Path d="M72 62 Q76 58 80 62" stroke="#5A4035" strokeWidth={1.8} fill="none" strokeLinecap="round" clipPath="url(#circle)" />
      <Path d="M94 54 Q99 49 104 54" stroke="#5A4035" strokeWidth={1.8} fill="none" strokeLinecap="round" clipPath="url(#circle)" />
    </Svg>
  );
}

type Props = {
  onWidenRadius: () => void;
};

export function EmptyDiscover({ onWidenRadius }: Props) {
  const theme  = Colors.light;
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { borderColor: theme.line }]}>
        <SunsetIllustration />
      </View>

      <ThemedText type="title" style={[styles.heading, { color: theme.ink }]}>
        Nothing nearby right now
      </ThemedText>
      <ThemedText type="smallBold" style={[styles.sub, { color: theme.muted }]}>
        Try widening your radius or{'\n'}check back later.
      </ThemedText>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnFilled, { backgroundColor: theme.action, opacity: pressed ? 0.85 : 1 }]}
          onPress={onWidenRadius}
        >
          <View style={styles.btnRow}>
            <ThemedText type="label" style={styles.btnFilledText}>Widen radius</ThemedText>
            <FontAwesome5 name="map-marker-alt" size={15} color={theme.bg} style={{ marginLeft: 6 }} />
          </View>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnOutline, { borderColor: theme.accent, opacity: pressed ? 0.75 : 1 }]}
          onPress={() => router.push('/host')}
        >
          <ThemedText type="label" style={[styles.btnOutlineText, { color: theme.accent }]}>Host a plan</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    overflow: 'hidden',
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  heading: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: Spacing.one,
  },
  sub: {
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: Spacing.two,
  },
  buttons: {
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  btn: {
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnRow:        { flexDirection: 'row', alignItems: 'center' },
  btnFilled:     { },
  btnOutline:    { borderWidth: 1.5, backgroundColor: 'transparent' },
  btnFilledText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnOutlineText:{ fontSize: 16, fontWeight: '600' },
});
