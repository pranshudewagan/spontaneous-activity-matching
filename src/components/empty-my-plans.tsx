import { useRouter } from 'expo-router';
import { Circle, ClipPath, Defs, Ellipse, Path, Rect, Svg } from 'react-native-svg';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';

const CIRCLE = 220;

// ─── Van illustration (arch frame) ───────────────────────────────────────────

function VanIllustration() {
  return (
    <Svg width={CIRCLE} height={200} viewBox="0 0 220 200">
      <Defs>
        <ClipPath id="van-arch">
          {/* arch = top semicircle (r=110, center 110,110) + rectangle bottom */}
          <Path d="M 0 110 A 110 110 0 0 1 220 110 L 220 200 L 0 200 Z" />
        </ClipPath>
      </Defs>

      {/* Sky */}
      <Rect x={0} y={0} width={220} height={200} fill="#F6D0A8" clipPath="url(#van-arch)" />

      {/* Sun glow + disc */}
      <Circle cx={110} cy={68} r={34} fill="#F7C49A" clipPath="url(#van-arch)" />
      <Circle cx={110} cy={68} r={22} fill="#F4A06A" clipPath="url(#van-arch)" />

      {/* Far dunes */}
      <Path
        d="M0 135 Q35 112 70 128 Q100 110 130 126 Q160 108 195 122 L220 115 L220 148 L0 148 Z"
        fill="#CFA882" clipPath="url(#van-arch)" />

      {/* Ground */}
      <Rect x={0} y={143} width={220} height={57} fill="#BA8C5C" clipPath="url(#van-arch)" />

      {/* Road (perspective) */}
      <Path d="M72 200 L94 141 L126 141 L148 200 Z" fill="#A87840" clipPath="url(#van-arch)" />
      {/* Centre-line dashes */}
      <Rect x={107} y={148} width={6} height={7} rx={1} fill="#C8944E" clipPath="url(#van-arch)" />
      <Rect x={107} y={160} width={6} height={7} rx={1} fill="#C8944E" clipPath="url(#van-arch)" />
      <Rect x={107} y={172} width={6} height={7} rx={1} fill="#C8944E" clipPath="url(#van-arch)" />
      <Rect x={107} y={184} width={6} height={7} rx={1} fill="#C8944E" clipPath="url(#van-arch)" />

      {/* Van roof section */}
      <Rect x={88} y={109} width={36} height={14} rx={3} fill="#E87050" clipPath="url(#van-arch)" />
      {/* Van windshield */}
      <Rect x={90} y={111} width={14} height={10} rx={2} fill="#C8E8F0" clipPath="url(#van-arch)" />
      {/* Van body */}
      <Rect x={84} y={121} width={52} height={22} rx={3} fill="#F4845F" clipPath="url(#van-arch)" />
      {/* Accent stripe */}
      <Rect x={84} y={129} width={52} height={4} fill="#E06040" clipPath="url(#van-arch)" />
      {/* Side windows */}
      <Rect x={112} y={123} width={13} height={9} rx={2} fill="#C8E8F0" clipPath="url(#van-arch)" />
      <Rect x={128} y={123} width={6} height={9} rx={2} fill="#C8E8F0" clipPath="url(#van-arch)" />
      {/* Wheels */}
      <Circle cx={97}  cy={143} r={7} fill="#2A1A0E" clipPath="url(#van-arch)" />
      <Circle cx={97}  cy={143} r={3} fill="#6A5040" clipPath="url(#van-arch)" />
      <Circle cx={125} cy={143} r={7} fill="#2A1A0E" clipPath="url(#van-arch)" />
      <Circle cx={125} cy={143} r={3} fill="#6A5040" clipPath="url(#van-arch)" />

      {/* Left palm trunk */}
      <Path d="M26 200 Q28 165 32 140 Q34 155 30 200 Z" fill="#7A5830" clipPath="url(#van-arch)" />
      {/* Left palm fronds */}
      <Path d="M30 142 Q8 128 -8 135 Q10 138 30 142 Z"  fill="#4A7A45" clipPath="url(#van-arch)" />
      <Path d="M30 142 Q14 122 4 126 Q16 134 30 142 Z"  fill="#5A8A55" clipPath="url(#van-arch)" />
      <Path d="M30 142 Q34 120 46 122 Q38 133 30 142 Z" fill="#4A7A45" clipPath="url(#van-arch)" />
      <Path d="M30 142 Q48 128 58 133 Q44 138 30 142 Z" fill="#3D6B40" clipPath="url(#van-arch)" />
      {/* Left coconuts */}
      <Circle cx={26} cy={144} r={3} fill="#8A6030" clipPath="url(#van-arch)" />
      <Circle cx={32} cy={146} r={3} fill="#8A6030" clipPath="url(#van-arch)" />

      {/* Right palm trunk */}
      <Path d="M194 200 Q192 165 188 140 Q186 155 190 200 Z" fill="#7A5830" clipPath="url(#van-arch)" />
      {/* Right palm fronds */}
      <Path d="M190 142 Q212 128 228 135 Q210 138 190 142 Z"  fill="#4A7A45" clipPath="url(#van-arch)" />
      <Path d="M190 142 Q206 122 216 126 Q204 134 190 142 Z"  fill="#5A8A55" clipPath="url(#van-arch)" />
      <Path d="M190 142 Q186 120 174 122 Q182 133 190 142 Z" fill="#4A7A45" clipPath="url(#van-arch)" />
      <Path d="M190 142 Q172 128 162 133 Q176 138 190 142 Z" fill="#3D6B40" clipPath="url(#van-arch)" />
      {/* Right coconuts */}
      <Circle cx={194} cy={144} r={3} fill="#8A6030" clipPath="url(#van-arch)" />
      <Circle cx={188} cy={146} r={3} fill="#8A6030" clipPath="url(#van-arch)" />

      {/* Birds */}
      <Path d="M62 58 Q66 54 70 58"  stroke="#5A4035" strokeWidth={1.6} fill="none" strokeLinecap="round" clipPath="url(#van-arch)" />
      <Path d="M76 48 Q81 43 86 48"  stroke="#5A4035" strokeWidth={1.6} fill="none" strokeLinecap="round" clipPath="url(#van-arch)" />
      <Path d="M140 52 Q145 47 150 52" stroke="#5A4035" strokeWidth={1.6} fill="none" strokeLinecap="round" clipPath="url(#van-arch)" />
    </Svg>
  );
}

// ─── Lighthouse illustration (circle frame) ───────────────────────────────────

function LighthouseIllustration() {
  const r = CIRCLE / 2;
  return (
    <Svg width={CIRCLE} height={CIRCLE} viewBox="0 0 220 220">
      <Defs>
        <ClipPath id="lh-circle">
          <Circle cx={r} cy={r} r={r} />
        </ClipPath>
      </Defs>

      {/* Sky */}
      <Rect x={0} y={0} width={220} height={220} fill="#D4E6E4" clipPath="url(#lh-circle)" />

      {/* Clouds */}
      <Ellipse cx={55}  cy={50} rx={28} ry={12} fill="#EEF6F5" clipPath="url(#lh-circle)" />
      <Ellipse cx={75}  cy={44} rx={20} ry={10} fill="#EEF6F5" clipPath="url(#lh-circle)" />
      <Ellipse cx={160} cy={60} rx={24} ry={10} fill="#EEF6F5" clipPath="url(#lh-circle)" />
      <Ellipse cx={178} cy={54} rx={18} ry={9}  fill="#EEF6F5" clipPath="url(#lh-circle)" />

      {/* Light beams */}
      <Path d="M110 72 L50 30 L58 42 Z"  fill="#F4E070" opacity={0.25} clipPath="url(#lh-circle)" />
      <Path d="M110 72 L170 30 L162 42 Z" fill="#F4E070" opacity={0.25} clipPath="url(#lh-circle)" />

      {/* Ocean */}
      <Rect x={0} y={148} width={220} height={72} fill="#2AAFA8" clipPath="url(#lh-circle)" />
      {/* Wave layers */}
      <Path
        d="M0 154 Q27 148 55 154 Q82 160 110 154 Q138 148 165 154 Q192 160 220 154 L220 163 Q192 169 165 163 Q138 157 110 163 Q82 169 55 163 Q27 157 0 163 Z"
        fill="#1E9E98" clipPath="url(#lh-circle)" />
      <Path
        d="M0 172 Q30 166 60 172 Q90 178 120 172 Q150 166 180 172 Q200 176 220 172 L220 180 Q200 184 180 180 Q150 174 120 180 Q90 186 60 180 Q30 174 0 180 Z"
        fill="#1A8A84" clipPath="url(#lh-circle)" />

      {/* Rocky cliffs */}
      <Path
        d="M42 185 Q58 162 78 150 Q95 142 110 144 Q125 142 142 150 Q162 162 178 185 L185 220 L35 220 Z"
        fill="#5C6A62" clipPath="url(#lh-circle)" />
      <Path
        d="M55 185 Q68 166 84 156 Q97 148 110 150 Q123 148 136 156 Q152 166 165 185 Z"
        fill="#4A5852" clipPath="url(#lh-circle)" />

      {/* Lighthouse body (white tower) */}
      <Rect x={103} y={75} width={14} height={72} rx={2} fill="#F5EDE8" clipPath="url(#lh-circle)" />
      {/* Red bands */}
      <Rect x={103} y={87}  width={14} height={9} fill="#D84830" clipPath="url(#lh-circle)" />
      <Rect x={103} y={107} width={14} height={9} fill="#D84830" clipPath="url(#lh-circle)" />
      <Rect x={103} y={127} width={14} height={9} fill="#D84830" clipPath="url(#lh-circle)" />

      {/* Lantern room */}
      <Rect x={100} y={64} width={20} height={13} rx={2} fill="#8A9A92" clipPath="url(#lh-circle)" />
      <Rect x={100} y={65} width={20} height={10} fill="#B8E4E2" opacity={0.8} clipPath="url(#lh-circle)" />
      {/* Cap */}
      <Path d="M100 64 L110 54 L120 64 Z" fill="#7A8A82" clipPath="url(#lh-circle)" />
      {/* Base on cliff */}
      <Rect x={99} y={145} width={22} height={6} rx={2} fill="#8A9A92" clipPath="url(#lh-circle)" />

      {/* Seabirds */}
      <Path d="M50 78 Q54 73 58 78"   stroke="#4A5A60" strokeWidth={1.5} fill="none" strokeLinecap="round" clipPath="url(#lh-circle)" />
      <Path d="M66 64 Q71 59 76 64"   stroke="#4A5A60" strokeWidth={1.5} fill="none" strokeLinecap="round" clipPath="url(#lh-circle)" />
      <Path d="M150 70 Q155 65 160 70" stroke="#4A5A60" strokeWidth={1.5} fill="none" strokeLinecap="round" clipPath="url(#lh-circle)" />
    </Svg>
  );
}

// ─── EmptyHosting ─────────────────────────────────────────────────────────────

export function EmptyHosting() {
  const theme  = Colors.light;
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={[styles.archFrame, { borderColor: theme.line }]}>
        <VanIllustration />
      </View>

      <ThemedText type="title" style={[styles.heading, { color: theme.ink }]}>
        No plans yet
      </ThemedText>
      <ThemedText type="smallBold" style={[styles.sub, { color: theme.muted }]}>
        Host your first plan or{'\n'}join one in Discover.
      </ThemedText>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnFilled, { backgroundColor: theme.action, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.push('/host')}>
          <ThemedText type="label" style={styles.btnFilledText}>Host a plan</ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnOutline, { borderColor: theme.accent, opacity: pressed ? 0.75 : 1 }]}
          onPress={() => router.navigate('/(app)')}>
          <ThemedText type="label" style={[styles.btnOutlineText, { color: theme.accent }]}>Go to Discover</ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

// ─── EmptyJoined ──────────────────────────────────────────────────────────────

export function EmptyJoined() {
  const theme  = Colors.light;
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={[styles.circle, { borderColor: theme.line }]}>
        <LighthouseIllustration />
      </View>

      <ThemedText type="title" style={[styles.heading, { color: theme.ink }]}>
        Nothing joined yet
      </ThemedText>
      <ThemedText type="smallBold" style={[styles.sub, { color: theme.muted }]}>
        Find something nearby and{'\n'}swipe right in Discover.
      </ThemedText>

      <View style={styles.buttons}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnFilled, { backgroundColor: theme.action, opacity: pressed ? 0.85 : 1 }]}
          onPress={() => router.navigate('/(app)')}>
          <ThemedText type="label" style={styles.btnFilledText}>Browse Discover</ThemedText>
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnOutline, { borderColor: theme.accent, opacity: pressed ? 0.75 : 1 }]}
          onPress={() => router.push('/host')}>
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

  archFrame: {
    width: CIRCLE,
    height: 200,
    alignSelf: 'center',
    marginBottom: Spacing.two,
    overflow: 'hidden',
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
  btnFilled:      {},
  btnOutline:     { borderWidth: 1.5, backgroundColor: 'transparent' },
  btnFilledText:  { color: '#fff', fontSize: 16, fontWeight: '600' },
  btnOutlineText: { fontSize: 16, fontWeight: '600' },
});
