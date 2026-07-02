import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    // DESIGN.md brand tokens — sunset ocean, warm-led
    action:  '#f66645',   // sunset coral — CTAs, swipe-right
    accent:  '#2AAFA8',   // ocean teal — links, trust, safety
    // DESIGN.md functional tokens
    bg:      '#FFFAF8',   // warm-tinted background
    ink:     '#1A100D',   // warm near-black — primary text
    muted:   '#7A6560',   // warm muted — secondary text, captions
    surface: '#FFFFFF',   // cards, sheets
    line:    '#EDE5E1',   // warm border/divider
    success: '#1E9E8E',   // ocean-tinted — accepted, confirmations
    warning: '#E09020',   // warm amber — waitlist, soft cautions
    danger:  '#D13E2A',   // warm red — destructive/safety only
    // legacy aliases (keep for existing components)
    text:               '#1A100D',
    background:         '#FFFAF8',
    backgroundElement:  '#F2EAE6',
    backgroundSelected: '#E8DDD8',
    textSecondary:      '#7A6560',
  },
  dark: {
    // DESIGN.md brand tokens
    action:  '#f66645',
    accent:  '#2AAFA8',
    // DESIGN.md functional tokens
    bg:      '#140F0D',
    ink:     '#F5EDE8',
    muted:   '#9E8880',
    surface: '#221812',
    line:    '#342520',
    success: '#1E9E8E',
    warning: '#E09020',
    danger:  '#D13E2A',
    // legacy aliases
    text:               '#F5EDE8',
    background:         '#140F0D',
    backgroundElement:  '#2A1C18',
    backgroundSelected: '#362420',
    textSecondary:      '#9E8880',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

// 4pt spacing scale
export const Spacing = {
  half: 2,
  one:  4,
  two:  8,
  three: 16,
  four:  24,
  five:  32,
  six:   64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
