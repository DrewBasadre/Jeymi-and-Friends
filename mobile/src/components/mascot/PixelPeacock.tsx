import Svg, { G, Rect } from 'react-native-svg';
import { colors } from '@/theme/tokens';

/**
 * Pixel-art peacock whose posture reflects performance.
 *
 * `stage` 0..4 drives how wide and high the tail unfurls and the mood:
 *   4 Radiant  — full glorious fan, bright, happy
 *   3 Proud    — wide fan, content
 *   2 Growing  — half fan, neutral
 *   1 Sleepy   — small fan, tired
 *   0 Resting  — feathers folded/drooping, needs care
 */
export type PeacockStage = 0 | 1 | 2 | 3 | 4;

export interface PeacockTier {
  stage: PeacockStage;
  tier: string;
  blurb: string;
}

/** Map a 0–100 score to a peacock stage + encouraging copy. */
export function peacockTier(scorePercent: number): PeacockTier {
  const s = Math.max(0, Math.min(100, Math.round(scorePercent)));
  if (s >= 85) return { stage: 4, tier: 'Radiant', blurb: 'Full bloom — feathers wide and glowing!' };
  if (s >= 70) return { stage: 3, tier: 'Proud', blurb: 'Bright and confident. Keep it up!' };
  if (s >= 50) return { stage: 2, tier: 'Growing', blurb: 'Fanning out nicely — you’re getting there.' };
  if (s >= 30) return { stage: 1, tier: 'Sleepy', blurb: 'Warming up. A little practice lifts those feathers.' };
  return { stage: 0, tier: 'Resting', blurb: 'Your peacock needs care — let’s practice together.' };
}

const FAN: Record<PeacockStage, { angle: number; length: number }[]> = {
  4: [-72, -48, -24, 0, 24, 48, 72].map((angle) => ({ angle, length: 22 })),
  3: [-52, -26, 0, 26, 52].map((angle) => ({ angle, length: 19 })),
  2: [-34, 0, 34].map((angle) => ({ angle, length: 15 })),
  1: [-18, 18].map((angle) => ({ angle, length: 11 })),
  0: [-158, 158].map((angle) => ({ angle, length: 10 })),
};

export function PixelPeacock({
  size = 96,
  stage = 2,
  accessibilityLabel = 'Pixel peacock',
}: {
  size?: number;
  stage?: PeacockStage;
  accessibilityLabel?: string;
}) {
  const happy = stage >= 3;
  const sad = stage <= 1;
  const dim = stage === 0;
  const bodyColor = dim ? '#3F5B57' : colors.primary;
  const bodyDark = dim ? '#31474433' : colors.primaryStrong;
  const belly = dim ? '#557873' : colors.gradientStart;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      {/* Tail fan (behind body) */}
      {FAN[stage].map((f, i) => (
        <Feather key={i} angle={f.angle} length={f.length} dim={dim} />
      ))}

      {/* Body */}
      <Rect x={24} y={34} width={16} height={20} rx={3} fill={bodyColor} />
      <Rect x={27} y={41} width={10} height={13} rx={3} fill={belly} />
      <Rect x={24} y={50} width={16} height={4} rx={2} fill={bodyDark} />

      {/* Head */}
      <Rect x={25} y={22} width={14} height={14} rx={3} fill={bodyColor} />

      {/* Crest — three gold dots on stalks */}
      <Rect x={31.5} y={13} width={1} height={5} fill={bodyColor} />
      <Rect x={27} y={15} width={1} height={4} fill={bodyColor} />
      <Rect x={36} y={15} width={1} height={4} fill={bodyColor} />
      <Rect x={30} y={11} width={4} height={4} fill={colors.accent} />
      <Rect x={25.5} y={13} width={3} height={3} fill={colors.accent} />
      <Rect x={35.5} y={13} width={3} height={3} fill={colors.accent} />

      {/* Eyes */}
      {happy ? (
        <>
          <Rect x={28} y={28} width={4} height={2} fill={colors.ink} />
          <Rect x={29} y={27} width={2} height={1} fill={colors.ink} />
          <Rect x={32} y={28} width={4} height={2} fill={colors.ink} />
          <Rect x={33} y={27} width={2} height={1} fill={colors.ink} />
          {/* rosy cheeks */}
          <Rect x={26} y={31} width={2} height={2} fill={colors.accent} opacity={0.6} />
          <Rect x={36} y={31} width={2} height={2} fill={colors.accent} opacity={0.6} />
        </>
      ) : (
        <>
          <Rect x={28} y={27} width={3} height={4} fill={colors.white} />
          <Rect x={29} y={sad ? 29 : 28} width={2} height={2} fill={colors.ink} />
          <Rect x={33} y={27} width={3} height={4} fill={colors.white} />
          <Rect x={34} y={sad ? 29 : 28} width={2} height={2} fill={colors.ink} />
          {sad ? <Rect x={27} y={26} width={10} height={1} fill={bodyDark} /> : null}
        </>
      )}

      {/* Beak */}
      <Rect x={30} y={31} width={4} height={2} fill={colors.accent} />
      <Rect x={31} y={33} width={2} height={1} fill={colors.accentPressed} />

      {/* Mouth */}
      {happy ? (
        <Rect x={30} y={34} width={4} height={1} fill={bodyDark} />
      ) : sad ? (
        <Rect x={30} y={35} width={4} height={1} fill={bodyDark} />
      ) : null}
    </Svg>
  );
}

function Feather({ angle, length, dim }: { angle: number; length: number; dim: boolean }) {
  const stem = dim ? '#6B8A85' : colors.gradientStart;
  const stemInner = dim ? '#4B6B66' : colors.secondary;
  const ring = dim ? '#3F5B57' : colors.gradientEnd;
  const eye = dim ? '#8AA39C' : colors.accent;
  return (
    <G rotation={angle} origin="32, 44">
      <Rect x={30.5} y={44 - length} width={3} height={length} fill={stem} />
      <Rect x={31.5} y={44 - length} width={1} height={length} fill={stemInner} />
      {/* eye-spot (pixel rings) */}
      <Rect x={28} y={44 - length - 7} width={8} height={8} rx={1} fill={ring} />
      <Rect x={29.5} y={44 - length - 5.5} width={5} height={5} fill={eye} />
      <Rect x={31} y={44 - length - 4} width={2} height={2} fill={dim ? '#5E7A75' : colors.primaryStrong} />
    </G>
  );
}
