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
  inkInverse: '#FFFFFF', // text on brand / dark surfaces
  outline: '#CDDDD6',
  outlineStrong: '#B7CCC5',
  hairline: '#E2EDE8', // faintest divider inside cards

  // Ink on dark (brand) surfaces — kept as tokens so screens never inline rgba
  onBrand: '#FFFFFF',
  onBrandMuted: 'rgba(255,255,255,0.78)',
  onBrandSubtle: 'rgba(255,255,255,0.58)',
  onBrandSurface: 'rgba(255,255,255,0.14)', // inset panel on brand
  onBrandLine: 'rgba(255,255,255,0.20)',

  // Deep teal "night" surfaces used by hero / focus moments
  canopy: '#0B3A38',
  canopyDeep: '#072B2A',
  scrim: 'rgba(9, 42, 40, 0.55)',
  sheen: 'rgba(255, 255, 255, 0.07)', // soft highlight bloom on hero surfaces

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
  xs: 6,
  sm: 8,
  md: 12, // inputs, buttons, small containers
  lg: 16, // cards
  xl: 24, // hero / feature cards, flashcards
  xxl: 28, // full-bleed hero, sheets
  round: 999,
} as const;

/**
 * Shared layout constants. Screens should read these instead of guessing
 * widths — it keeps phone, foldable and tablet rhythm consistent.
 */
export const layout = {
  maxContentWidth: 760,
  gutter: 20,
  tabBarHeight: 62,
  /** Extra bottom padding so content clears the floating tab bar. */
  tabBarClearance: 96,
} as const;

// ── Typography scale (system font; friendly weights) ────────────────────────
type TypeToken = Pick<
  TextStyle,
  'fontSize' | 'lineHeight' | 'fontWeight' | 'letterSpacing'
>;

/**
 * Headings carry a slight negative tracking (optical correction) so large
 * system-font text reads tight and editorial rather than loose and default —
 * the single cheapest lever for a "designed, not templated" feel.
 */
export const text = {
  hero: { fontSize: 40, lineHeight: 45, fontWeight: '800', letterSpacing: -1 },
  display: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.7 },
  h1: { fontSize: 27, lineHeight: 33, fontWeight: '800', letterSpacing: -0.5 },
  h2: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.35 },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700', letterSpacing: -0.2 },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '700', letterSpacing: -0.1 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodySm: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  tiny: { fontSize: 11, lineHeight: 15, fontWeight: '700' },
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  metric: { fontSize: 28, lineHeight: 32, fontWeight: '800', letterSpacing: -0.6 },
  /** Tabular-feeling big number for scores and levels. */
  numeral: { fontSize: 44, lineHeight: 48, fontWeight: '800', letterSpacing: -1.4 },
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
  e0: shadow(1, 3, 0.04, 1), // barely-there lift (chips, tiles)
  e1: shadow(2, 8, 0.06, 2), // resting cards
  e2: shadow(6, 16, 0.1, 6), // raised / interactive
  e3: shadow(12, 28, 0.16, 12), // sheets, celebrations
  /** Warm halo behind earned/gamified elements. Use sparingly. */
  glow: Platform.select({
    ios: {
      shadowColor: '#E0A11B',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.34,
      shadowRadius: 14,
    },
    android: { elevation: 6 },
    default: {},
  }) as object,
} as const;

/**
 * Named gradient ramps (start → end). Rendered through `GradientView` in the
 * UI kit, which draws them with react-native-svg — no extra dependency.
 */
export const gradients = {
  brand: ['#12A594', '#0E6B93'], // teal → ocean: progress, brand marks
  hero: ['#12796F', '#0B3A38'], // rich teal descent for hero surfaces
  night: ['#0B3A38', '#072B2A'], // focus surfaces (flashcards, quiz)
  gold: ['#F0C25A', '#D08A0B'], // achievements, level-up moments
  ocean: ['#1191B8', '#0B5474'],
  science: ['#12A594', '#0F766E'],
  math: ['#E3A93B', '#B67D0C'],
  english: ['#22A870', '#0E8A5F'],
  reading: ['#1191B8', '#0E6B93'],
  added: ['#E98A72', '#C25640'],
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

/** Matching wash for each subject — chips, icon plates, card headers. */
export const subjectTint = {
  SCIENCE: colors.primaryTint,
  MATH: colors.accentTint,
  ENGLISH: colors.successTint,
  READING: colors.secondaryTint,
  ADDED_MATERIALS: colors.coralTint,
} as const;

/** Gradient ramp per subject, for spine accents and subject headers. */
export const subjectGradient = {
  SCIENCE: gradients.science,
  MATH: gradients.math,
  ENGLISH: gradients.english,
  READING: gradients.reading,
  ADDED_MATERIALS: gradients.added,
} as const;

// Status chip palettes (bg + text, AA-checked)
export const statusPalette = {
  completed: { bg: colors.successTint, fg: '#0A6E4C' },
  inProgress: { bg: colors.warningTint, fg: '#8A5B00' },
  notStarted: { bg: colors.surfaceMuted, fg: colors.inkMuted },
  locked: { bg: colors.surfaceSunken, fg: colors.inkSubtle },
} as const;
