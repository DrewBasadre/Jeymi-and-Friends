import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
} from 'react-native';
import { colors } from '@/theme/tokens';

/**
 * Shared typewriter used by both AI bots (student CompanionResult and teacher
 * AiReportCard) so the two behave identically.
 *
 * The Pavo backend returns a full structured JSON response (no token
 * streaming), so this animates the already-received text — revealing a list of
 * prose segments one after another with a blinking cursor. It is skippable
 * (call `skip`) and fully honours reduce-motion (everything shows at once).
 */
export function useTypewriterSequence(
  segments: string[],
  { play, charsPerSecond = 55 }: { play: boolean; charsPerSecond?: number },
): {
  /** Text to render for a given segment index (full, partial, or empty). */
  textFor: (index: number) => string;
  /** True while the given segment is mid-type (show the cursor here). */
  isTyping: (index: number) => boolean;
  /** True once a segment has begun (use to reveal its heading / block). */
  isRevealed: (index: number) => boolean;
  /** All segments fully shown. */
  done: boolean;
  /** Jump straight to the fully-revealed state. */
  skip: () => void;
} {
  const total = segments.length;
  const [active, setActive] = useState(play ? 0 : total);
  const [shown, setShown] = useState(play ? 0 : Infinity);
  const finished = active >= total;

  // Respect reduce-motion: reveal everything immediately.
  useEffect(() => {
    if (!play) return;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!cancelled && reduce) {
        setActive(total);
        setShown(Infinity);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [play, total]);

  useEffect(() => {
    if (active >= total) return;
    const text = segments[active] ?? '';
    if (shown >= text.length) {
      // Segment complete — brief beat, then advance to the next.
      const advance = setTimeout(() => {
        setActive((value) => value + 1);
        setShown(0);
      }, 90);
      return () => clearTimeout(advance);
    }
    const perTick = Math.max(1, Math.round(charsPerSecond / 30));
    const tick = setTimeout(() => setShown((value) => value + perTick), 1000 / 30);
    return () => clearTimeout(tick);
  }, [active, shown, segments, total, charsPerSecond]);

  return {
    textFor: (index) => {
      if (index < active) return segments[index] ?? '';
      if (index === active) return (segments[index] ?? '').slice(0, shown);
      return '';
    },
    isTyping: (index) => play && index === active && !finished,
    isRevealed: (index) => index <= active,
    done: finished,
    skip: () => {
      setActive(total);
      setShown(Infinity);
    },
  };
}

/** A blinking block cursor shown at the end of the line currently typing. */
export function TypeCursor({ color = colors.primary }: { color?: string }) {
  const blink = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 0, duration: 480, easing: Easing.ease, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 480, easing: Easing.ease, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [blink]);
  return <Animated.Text style={[styles.cursor, { color, opacity: blink }]}>▌</Animated.Text>;
}

/**
 * One prose line that types out. Renders nothing until it has started, so a
 * caller can reveal a heading alongside its body only when the body begins.
 */
export function TypewriterLine({
  text,
  typing,
  style,
  cursorColor,
}: {
  text: string;
  typing: boolean;
  style?: StyleProp<TextStyle>;
  cursorColor?: string;
}) {
  return (
    <Text style={style}>
      {text}
      {typing ? <TypeCursor color={cursorColor} /> : null}
    </Text>
  );
}

const styles = StyleSheet.create({
  cursor: { fontWeight: '400' },
});
