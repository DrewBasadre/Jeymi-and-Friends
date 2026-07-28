import type { TextStyle } from 'react-native';
import { Platform } from 'react-native';

/**
 * Pavo design tokens — "Peacock" system.
 *
 * A green–blue identity drawn from peacock plumage: deep teal primary,
 * ocean-blue secondary, and a warm gold accent that echoes the eye-spots.
 * Light theme, WCAG 2.1 AA text pairings, friendly rounded geometry.
 *
 * Legacy key names (indigo / emerald / amber …) are preserved but remapped
 * to peacock values so every existing screen adopts the new look instantly.
 * New code should prefer the semantic names (primary / secondary / accent …).
 */

// ── Neutral ramp (very lightly teal-tinted slate) ───────────────────────────
const neutral = {
  n0: '#FFFFFF',
  n50: '#F2F8F5',
  n100: '#E7F0EC',
  n200: '#D3E2DC',
  n300: '#B7CCC5',
  n400: '#8AA39C',
  n500: '#647A75',
  n600: '#4C5F5C',
  n700: '#354744',
  n800: '#1F302D',
  n900: '#0F2A28',
} as const;

export const colors = {
  // Surfaces & text
  background: '#F2F8F5', // soft light-mint app background
  surface: '#FFFFFF',
  surfaceMuted: '#E9F1ED',
  surfaceSunken: '#E1EDE8',
  ink: '#0F2A28', // deep teal-slate headings
  inkMuted: '#4C5F5C', // secondary text (AA on white & mint)
  inkSubtle: '#647A75',
  outline: '#CDDDD6',
  outlineStrong: '#B7CCC5',

  // ── Brand: peacock ────────────────────────────────────────────────
  primary: '#0F766E', // deep teal — primary actions (5.1:1 on white)
  primaryPressed: '#115E59',
  primaryTint: '#DCF0EC',
  primaryStrong: '#0B5A54',

  secondary: '#0E6B93', // ocean blue (5.5:1 on white)
  secondaryPressed: '#0B5474',
  secondaryTint: '#DDEDF4',

  accent: '#E0A11B', // peacock-eye gold — highlights only
  accentPressed: '#B67D0C',
  accentText: '#8A5B00', // AA gold-ish text on white
  accentTint: '#FBEED1',

  // Iridescent gradient (teal → ocean blue) for progress, brand marks
  gradientStart: '#12A594',
  gradientMid: '#0F8AA0',
  gradientEnd: '#0E6B93',

  // ── Semantic ──────────────────────────────────────────────────────
  success: '#0E8A5F',
  successTint: '#D6F3E4',
  warning: '#B45309',
  warningTint: '#FBEBD2',
  error: '#C0392B',
  errorTint: '#FBE4E0',
  info: '#0E6B93',
  infoTint: '#DDEDF4',
  danger: '#C0392B', // legacy alias for error

  // ── Legacy aliases (remapped to peacock) ──────────────────────────
  indigo: '#0F766E', // was primary indigo → now teal
  indigoPressed: '#115E59',
  indigoTint: '#DCF0EC',
  emerald: '#0E8A5F',
  emeraldTint: '#D6F3E4',
  amber: '#B45309',
  amberTint: '#FBEBD2',
  coral: '#DC5A46',
  coralTint: '#FDE8E4',

  // Subject accents (peacock-coherent)
  science: '#0F766E', // teal
  math: '#C77F0A', // gold
  english: '#0E8A5F', // emerald
  reading: '#0E6B93', // ocean blue

  white: '#FFFFFF',
  black: '#000000',
  ...neutral,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

// Lean rounded for friendliness.
export const radius = {
  sm: 8,
  md: 12, // inputs, buttons, small containers
  lg: 16, // cards
  xl: 24, // hero / feature cards, flashcards
  round: 999,
} as const;

// ── Typography scale (system font; friendly weights) ────────────────────────
type TypeToken = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'
>;

export const text = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800' },
  h1: { fontSize: 27, lineHeight: 33, fontWeight: '800' },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  metric: { fontSize: 28, lineHeight: 32, fontWeight: '800' },
} as const satisfies Record<string, TypeToken>;

// ── Elevation (soft, teal-tinted shadows) ───────────────────────────────────
const shadow = (
  y: number,
  blur: number,
  opacity: number,
  elevation: number,
) =>
  Platform.select({
    ios: {
      shadowColor: '#0B3A34',
      shadowOffset: { width: 0, height: y },
      shadowOpacity: opacity,
      shadowRadius: blur,
    },
    android: { elevation },
    default: {},
  }) as object;

export const elevation = {
  none: {},
  e1: shadow(2, 8, 0.06, 2), // resting cards
  e2: shadow(6, 16, 0.1, 6), // raised / interactive
  e3: shadow(12, 28, 0.16, 12), // sheets, celebrations
} as const;

// ── Motion ───────────────────────────────────────────────────────────────
export const motion = {
  duration: { fast: 120, base: 200, slow: 320, celebrate: 900 },
  // React Native Easing-friendly bezier control points
  easing: {
    standard: [0.2, 0, 0, 1] as const,
    decelerate: [0, 0, 0.2, 1] as const,
    spring: { damping: 14, stiffness: 160, mass: 0.9 },
  },
} as const;

export const subjectColor = {
  SCIENCE: colors.science,
  MATH: colors.math,
  ENGLISH: colors.english,
  READING: colors.reading,
  ADDED_MATERIALS: colors.coral,
} as const;

// Status chip palettes (bg + text, AA-checked)
export const statusPalette = {
  completed: { bg: colors.successTint, fg: '#0A6E4C' },
  inProgress: { bg: colors.warningTint, fg: '#8A5B00' },
  notStarted: { bg: colors.surfaceMuted, fg: colors.inkMuted },
  locked: { bg: colors.surfaceSunken, fg: colors.inkSubtle },
} as const;
