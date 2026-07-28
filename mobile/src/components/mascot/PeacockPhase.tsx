import Svg, { G, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';

/**
 * The Pavo mascot as a 5-phase GROWTH peacock, rendered in crisp pixel art.
 *
 * The same character matures from a small cream chick (Phase 1) to a full
 * iridescent tail display (Phase 5): the body deepens from cream to teal, the
 * crest fills in, and the tail gains feathers and gold ocelli. Proportions and
 * placement stay constant across phases so it reads as one peacock growing.
 *
 * Centralized + swappable: this is the single source of mascot art. Real
 * pixel sprites can later replace the draw functions without touching callers.
 *
 * Rendering: axis-aligned <Rect> on integer coordinates with flat fills — no
 * gradients, no anti-aliasing — so it stays crisp at any integer scale.
 */
export type PeacockPhaseNumber = 1 | 2 | 3 | 4 | 5;

const CREAM = '#F4EAD1';
const CREAM_SHADE = '#E4D3A9';
const TEAL = colors.primary; // deep teal body
const TEAL_DEEP = colors.primaryStrong;
const TEAL_BRIGHT = colors.gradientStart;
const NAVY = colors.secondaryPressed;
const GOLD = colors.accent;
const GOLD_DEEP = colors.accentPressed;
const INK = colors.ink;

interface PhaseConfig {
  body: string;
  bodyShade: string;
  belly: string;
  head: string;
  crestDots: number;
  feathers: { angle: number; length: number }[];
  ocelli: boolean;
  cheeks: boolean;
  sparkle: boolean;
  happy: boolean;
}

const PHASES: Record<PeacockPhaseNumber, PhaseConfig> = {
  1: {
    body: CREAM, bodyShade: CREAM_SHADE, belly: '#FBF4E2', head: CREAM,
    crestDots: 1, feathers: [], ocelli: false, cheeks: true, sparkle: false, happy: true,
  },
  2: {
    body: '#8FB7AE', bodyShade: '#6E9C93', belly: '#B5D6CE', head: '#8FB7AE',
    crestDots: 1, feathers: [-16, 16].map((angle) => ({ angle, length: 9 })),
    ocelli: false, cheeks: true, sparkle: false, happy: true,
  },
  3: {
    body: TEAL, bodyShade: TEAL_DEEP, belly: TEAL_BRIGHT, head: TEAL,
    crestDots: 3, feathers: [-30, 0, 30].map((angle) => ({ angle, length: 14 })),
    ocelli: true, cheeks: false, sparkle: false, happy: true,
  },
  4: {
    body: TEAL, bodyShade: TEAL_DEEP, belly: TEAL_BRIGHT, head: TEAL,
    crestDots: 3, feathers: [-46, -23, 0, 23, 46].map((angle) => ({ angle, length: 18 })),
    ocelli: true, cheeks: true, sparkle: false, happy: true,
  },
  5: {
    body: TEAL, bodyShade: TEAL_DEEP, belly: TEAL_BRIGHT, head: TEAL,
    crestDots: 3, feathers: [-72, -48, -24, 0, 24, 48, 72].map((angle) => ({ angle, length: 22 })),
    ocelli: true, cheeks: true, sparkle: true, happy: true,
  },
};

export function PeacockPhase({
  phase = 1,
  size = 96,
  accessibilityLabel,
}: {
  phase?: PeacockPhaseNumber;
  size?: number;
  accessibilityLabel?: string;
}) {
  const cfg = PHASES[phase];
  // Integer size keeps the flat-fill pixel art on a whole-pixel grid, and
  // shapeRendering="crispEdges" is the RN-SVG equivalent of image-rendering:
  // pixelated — it suppresses anti-aliasing seams between adjacent rects.
  const dimension = Math.max(1, Math.round(size));
  return (
    <Svg
      width={dimension}
      height={dimension}
      viewBox="0 0 64 64"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel ?? `Pavo the peacock, phase ${phase} of 5`}
    >
      <G shapeRendering="crispEdges">
      {/* Tail fan (behind the body) */}
      {cfg.feathers.map((f, i) => (
        <Feather key={i} angle={f.angle} length={f.length} ocelli={cfg.ocelli} />
      ))}

      {/* Sparkles for the final phase */}
      {cfg.sparkle ? (
        <>
          <Rect x={12} y={16} width={2} height={2} fill={GOLD} />
          <Rect x={50} y={14} width={2} height={2} fill={GOLD} />
          <Rect x={8} y={30} width={2} height={2} fill={GOLD} />
        </>
      ) : null}

      {/* Body */}
      <Rect x={24} y={34} width={16} height={20} rx={3} fill={cfg.body} />
      <Rect x={27} y={41} width={10} height={13} rx={3} fill={cfg.belly} />
      <Rect x={24} y={50} width={16} height={4} rx={2} fill={cfg.bodyShade} />
      {/* Feet */}
      <Rect x={27} y={54} width={3} height={2} fill={GOLD_DEEP} />
      <Rect x={34} y={54} width={3} height={2} fill={GOLD_DEEP} />

      {/* Head */}
      <Rect x={25} y={22} width={14} height={14} rx={3} fill={cfg.head} />

      {/* Crest */}
      {cfg.crestDots >= 1 ? <Rect x={31.5} y={13} width={1} height={5} fill={cfg.bodyShade} /> : null}
      {cfg.crestDots >= 3 ? <Rect x={27} y={15} width={1} height={4} fill={cfg.bodyShade} /> : null}
      {cfg.crestDots >= 3 ? <Rect x={36} y={15} width={1} height={4} fill={cfg.bodyShade} /> : null}
      {cfg.crestDots >= 1 ? <Rect x={30} y={11} width={4} height={4} fill={GOLD} /> : null}
      {cfg.crestDots >= 3 ? <Rect x={25.5} y={13} width={3} height={3} fill={GOLD} /> : null}
      {cfg.crestDots >= 3 ? <Rect x={35.5} y={13} width={3} height={3} fill={GOLD} /> : null}

      {/* Eyes */}
      {cfg.happy ? (
        <>
          <Rect x={28} y={28} width={4} height={2} fill={INK} />
          <Rect x={29} y={27} width={2} height={1} fill={INK} />
          <Rect x={32} y={28} width={4} height={2} fill={INK} />
          <Rect x={33} y={27} width={2} height={1} fill={INK} />
        </>
      ) : (
        <>
          <Rect x={28} y={27} width={3} height={4} fill={colors.white} />
          <Rect x={29} y={28} width={2} height={2} fill={INK} />
          <Rect x={33} y={27} width={3} height={4} fill={colors.white} />
          <Rect x={34} y={28} width={2} height={2} fill={INK} />
        </>
      )}
      {cfg.cheeks ? (
        <>
          <Rect x={26} y={31} width={2} height={2} fill={GOLD} opacity={0.55} />
          <Rect x={36} y={31} width={2} height={2} fill={GOLD} opacity={0.55} />
        </>
      ) : null}

      {/* Beak + smile */}
      <Rect x={30} y={31} width={4} height={2} fill={GOLD} />
      <Rect x={31} y={33} width={2} height={1} fill={GOLD_DEEP} />
      <Rect x={30} y={34} width={4} height={1} fill={cfg.bodyShade} />
      </G>
    </Svg>
  );
}

function Feather({ angle, length, ocelli }: { angle: number; length: number; ocelli: boolean }) {
  return (
    <G rotation={angle} origin="32, 44">
      <Rect x={30.5} y={44 - length} width={3} height={length} fill={TEAL_BRIGHT} />
      <Rect x={31.5} y={44 - length} width={1} height={length} fill={NAVY} />
      {ocelli ? (
        <>
          <Rect x={28} y={44 - length - 7} width={8} height={8} rx={1} fill={NAVY} />
          <Rect x={29.5} y={44 - length - 5.5} width={5} height={5} fill={GOLD} />
          <Rect x={31} y={44 - length - 4} width={2} height={2} fill={TEAL_DEEP} />
        </>
      ) : (
        <Rect x={29.5} y={44 - length - 3} width={5} height={4} rx={1} fill={TEAL} />
      )}
    </G>
  );
}

// ── Progress → phase mapping ────────────────────────────────────────────────

export interface PeacockGrowth {
  phase: PeacockPhaseNumber;
  name: string;
  blurb: string;
}

const PHASE_META: Record<PeacockPhaseNumber, { name: string; blurb: string }> = {
  1: { name: 'Hatchling', blurb: 'Freshly hatched! Finish a lesson to help Pavo grow.' },
  2: { name: 'Fledgling', blurb: 'Finding its feathers — keep the momentum going.' },
  3: { name: 'Plumed', blurb: 'Colors are coming in. You’re on a roll!' },
  4: { name: 'Brilliant', blurb: 'Almost in full bloom — so close now.' },
  5: { name: 'Radiant', blurb: 'Full iridescent display. Outstanding work!' },
};

function phaseFromGrowth(growth: number): PeacockPhaseNumber {
  const g = Math.max(0, Math.min(0.999, growth));
  return (1 + Math.floor(g * 5)) as PeacockPhaseNumber;
}

/** Phase from real progress: completion (weighted) blended with mastery. */
export function peacockPhase(input: {
  completedModules?: number;
  totalModules?: number;
  averageScore?: number;
}): PeacockGrowth {
  const completed = input.completedModules ?? 0;
  const total = input.totalModules ?? 0;
  const completion = total > 0 ? completed / total : Math.min(1, completed / 6);
  const mastery = Math.max(0, Math.min(1, (input.averageScore ?? 0) / 100));
  const phase = phaseFromGrowth(completion * 0.6 + mastery * 0.4);
  return { phase, ...PHASE_META[phase] };
}

/** Phase from a single 0–100 score (for compact places like leaderboard rows). */
export function peacockPhaseFromScore(score: number): PeacockGrowth {
  const phase = phaseFromGrowth(Math.max(0, Math.min(100, score)) / 100);
  return { phase, ...PHASE_META[phase] };
}
