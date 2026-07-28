import { useMemo } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import { colors } from '@/theme/tokens';

export type PeacockExpression = 'idle' | 'happy' | 'encouraging';

export function Peacock({
  size = 96,
  expression = 'idle',
  accessibilityLabel = 'Pavo the peacock',
}: {
  size?: number;
  expression?: PeacockExpression;
  accessibilityLabel?: string;
}) {
  // Fan of tail feathers behind the body.
  const feathers = useMemo(
    () => [-52, -34, -17, 0, 17, 34, 52].map((angle, i) => ({ angle, i })),
    [],
  );

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
    >
      <Defs>
        <LinearGradient id="plume" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.gradientStart} />
          <Stop offset="1" stopColor={colors.gradientEnd} />
        </LinearGradient>
        <RadialGradient id="eyeSpot" cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor={colors.accent} />
          <Stop offset="0.6" stopColor={colors.accent} />
          <Stop offset="0.62" stopColor={colors.gradientEnd} />
          <Stop offset="1" stopColor={colors.gradientEnd} />
        </RadialGradient>
        <LinearGradient id="belly" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.gradientMid} />
          <Stop offset="1" stopColor={colors.primaryStrong} />
        </LinearGradient>
      </Defs>

      {/* Tail fan */}
      <G>
        {feathers.map(({ angle, i }) => (
          <G key={i} rotation={angle} origin="60, 74">
            <Ellipse
              cx={60}
              cy={30}
              rx={8}
              ry={30}
              fill="url(#plume)"
              opacity={0.95}
            />
            <Circle cx={60} cy={20} r={6.5} fill="url(#eyeSpot)" />
            <Circle cx={60} cy={20} r={2.4} fill={colors.primaryStrong} />
          </G>
        ))}
      </G>

      {/* Body */}
      <Ellipse cx={60} cy={80} rx={22} ry={26} fill="url(#belly)" />
      {/* Chest highlight */}
      <Ellipse cx={60} cy={86} rx={12} ry={15} fill={colors.gradientStart} opacity={0.35} />

      {/* Head */}
      <Circle cx={60} cy={54} r={16} fill={colors.primary} />
      {/* Crest */}
      {[-10, 0, 10].map((dx, i) => (
        <G key={i}>
          <Path
            d={`M60 38 q${dx / 2} -6 ${dx} -10`}
            stroke={colors.primaryStrong}
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
          />
          <Circle cx={60 + dx} cy={27} r={2.6} fill={colors.accent} />
        </G>
      ))}

      {/* Beak */}
      <Path d="M60 58 l-7 6 l7 3 z" fill={colors.accent} />

      {/* Face expression */}
      <Face expression={expression} />
    </Svg>
  );
}

function Face({ expression }: { expression: PeacockExpression }) {
  const eyeWhite = colors.white;
  const pupil = colors.ink;
  if (expression === 'happy') {
    // Cheerful closed arcs + smile
    return (
      <G>
        <Path d="M50 52 q4 -5 8 0" stroke={pupil} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <Path d="M62 52 q4 -5 8 0" stroke={pupil} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <Path d="M54 62 q6 5 12 0" stroke={pupil} strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <Circle cx={49} cy={58} r={3} fill={colors.accent} opacity={0.5} />
        <Circle cx={71} cy={58} r={3} fill={colors.accent} opacity={0.5} />
      </G>
    );
  }
  if (expression === 'encouraging') {
    // A friendly wink
    return (
      <G>
        <Circle cx={54} cy={52} r={4.5} fill={eyeWhite} />
        <Circle cx={55} cy={52.5} r={2.4} fill={pupil} />
        <Path d="M63 53 q4 -3 8 0" stroke={pupil} strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <Path d="M54 62 q6 4 11 0.5" stroke={pupil} strokeWidth={2.2} fill="none" strokeLinecap="round" />
      </G>
    );
  }
  // idle — calm, attentive
  return (
    <G>
      <Circle cx={54} cy={52} r={4.5} fill={eyeWhite} />
      <Circle cx={55} cy={52.5} r={2.4} fill={pupil} />
      <Circle cx={67} cy={52} r={4.5} fill={eyeWhite} />
      <Circle cx={68} cy={52.5} r={2.4} fill={pupil} />
    </G>
  );
}
