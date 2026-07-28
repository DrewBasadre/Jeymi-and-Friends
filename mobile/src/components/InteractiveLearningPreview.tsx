import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from 'lucide-react-native';
import type { BundledQuizQuestion, ReviewItem } from '@/domain/types';
import { Callout, ProgressBar } from '@/components/ui';
import { colors, radius, spacing, text } from '@/theme/tokens';

export function InteractiveLearningPreview({
  reviewItems,
  questions = [],
}: {
  reviewItems: ReviewItem[];
  questions?: BundledQuizQuestion[];
}) {
  const cards = reviewItems.filter(
    (item) => item.type === 'flashcard' || item.type === 'concept-summary',
  );
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const card = cards[cardIndex];

  return (
    <View style={styles.root}>
      {card ? (
        <View style={styles.block}>
          <View style={styles.header}>
            <Text style={styles.heading}>Flashcards</Text>
            <Text style={styles.counter}>
              {cardIndex + 1} of {cards.length}
            </Text>
          </View>
          <ProgressBar
            value={(cardIndex + 1) / cards.length}
            height={7}
            accessibilityLabel={`Flashcard ${cardIndex + 1} of ${cards.length}`}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityHint="Flips the flashcard"
            onPress={() => setFlipped((value) => !value)}
            style={({ pressed }) => [
              styles.flashcard,
              flipped && styles.flashcardBack,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.side}>{flipped ? 'ANSWER' : 'PROMPT'}</Text>
            <Text
              style={styles.cardText}
              numberOfLines={8}
              adjustsFontSizeToFit
              minimumFontScale={0.65}
            >
              {flipped ? card.answer : card.prompt}
            </Text>
            <View style={styles.flip}>
              <RotateCcw size={15} color={colors.onBrandMuted} />
              <Text style={styles.flipText}>Tap to flip</Text>
            </View>
          </Pressable>
          <View style={styles.navigation}>
            <Pressable
              accessibilityLabel="Previous flashcard"
              disabled={cardIndex === 0}
              onPress={() => {
                setCardIndex((value) => Math.max(0, value - 1));
                setFlipped(false);
              }}
              style={[
                styles.navButton,
                cardIndex === 0 && styles.navButtonDisabled,
              ]}
            >
              <ChevronLeft size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              accessibilityLabel="Next flashcard"
              disabled={cardIndex === cards.length - 1}
              onPress={() => {
                setCardIndex((value) =>
                  Math.min(cards.length - 1, value + 1),
                );
                setFlipped(false);
              }}
              style={[
                styles.navButton,
                cardIndex === cards.length - 1 && styles.navButtonDisabled,
              ]}
            >
              <ChevronRight size={20} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {questions.length > 0 ? (
        <View style={styles.block}>
          <Text style={styles.heading}>Practice quiz</Text>
          {questions.map((question, index) => {
            const chosen = answers[question.questionId];
            return (
              <View key={question.questionId} style={styles.question}>
                <Text style={styles.questionText}>
                  {index + 1}. {question.prompt}
                </Text>
                {question.options?.map((option, optionIndex) => {
                  const answered = chosen !== undefined;
                  const selected = option === chosen;
                  const correct = option === question.correctAnswer;
                  return (
                    <Pressable
                      key={`${question.questionId}-${optionIndex}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      disabled={answered}
                      onPress={() =>
                        setAnswers((current) => ({
                          ...current,
                          [question.questionId]: option,
                        }))
                      }
                      style={[
                        styles.option,
                        selected && !correct && styles.optionWrong,
                        answered && correct && styles.optionCorrect,
                      ]}
                    >
                      <Text style={styles.optionLetter}>
                        {String.fromCharCode(65 + optionIndex)}
                      </Text>
                      <Text style={styles.optionText}>{option}</Text>
                    </Pressable>
                  );
                })}
                {chosen !== undefined ? (
                  <Callout
                    title={
                      chosen === question.correctAnswer
                        ? 'Correct'
                        : 'Review this one'
                    }
                    body={`Correct answer: ${question.correctAnswer}`}
                    tone={
                      chosen === question.correctAnswer ? 'success' : 'info'
                    }
                  />
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xl },
  block: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  heading: { ...text.title, color: colors.ink },
  counter: { ...text.caption, color: colors.inkMuted },
  flashcard: {
    minHeight: 220,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
  },
  flashcardBack: { backgroundColor: colors.secondary },
  side: { ...text.overline, color: colors.onBrandSubtle },
  cardText: { ...text.h2, color: colors.white, textAlign: 'center' },
  flip: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flipText: { ...text.caption, color: colors.onBrandMuted },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  navButton: {
    width: 44,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  navButtonDisabled: { opacity: 0.35 },
  question: { gap: spacing.sm, paddingVertical: spacing.sm },
  questionText: { ...text.bodyStrong, color: colors.ink },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  optionCorrect: {
    borderColor: colors.success,
    backgroundColor: colors.successTint,
  },
  optionWrong: {
    borderColor: colors.error,
    backgroundColor: colors.errorTint,
  },
  optionLetter: { ...text.label, color: colors.primary, width: 24 },
  optionText: { ...text.bodySm, color: colors.ink, flex: 1 },
  pressed: { opacity: 0.86 },
});
