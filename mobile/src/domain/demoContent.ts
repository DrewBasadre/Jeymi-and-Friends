import { parseAdaptiveLesson, type AdaptiveLesson } from './adaptiveLesson';
import { DEFAULT_QUIZ_POLICY, type AssessmentQuestion } from './assessmentModel';
import type { QuizDraftInput } from './quizAuthoring';

/**
 * Original demo packages shared by the web studio and the Android demo
 * classroom, so both tell the same story. Written for PAVO; not DepEd text.
 */
export interface DemoPackage {
  id: string;
  title: string;
  gradeLevel: number;
  subject: string;
  competencies: string[];
  lesson: AdaptiveLesson;
  quiz: QuizDraftInput | null;
}

function q(question: Partial<AssessmentQuestion> & Pick<AssessmentQuestion, 'id' | 'kind' | 'prompt' | 'answer' | 'topic' | 'competency'>): AssessmentQuestion {
  return {
    choices: question.kind === 'true_false' ? ['True', 'False'] : [],
    acceptedAnswers: [],
    rationale: '',
    difficulty: 'medium',
    points: 1,
    misconception: '',
    intervention: '',
    remediationRef: '',
    ...question,
  };
}

const plantsLesson = `---
pavo: adaptive-lesson
schemaVersion: 1
lessonId: demo-plants-make-food
title: How plants make food
gradeLevel: 5
subject: Science
competencies: S5LT-IIa-1, S5LT-IIa-2
estimatedMinutes: 20
language: en
---

::: objective {id="objective"}
By the end of this lesson you can name the plant part that makes food and the three things a plant needs to make it.
:::

::: concept {id="leaves" concept="leaves"}
**Leaves are the plant's kitchen.** Inside each leaf is a green pigment called *chlorophyll*. Chlorophyll catches sunlight, and the leaf uses that energy to turn water and carbon dioxide into sugar. This process is called **photosynthesis**.
:::

::: read-aloud {id="read-aloud" concept="leaves"}
Roots drink. Stems carry. Leaves cook. The sun is the stove, water and air are the ingredients, and sugar is the meal.
:::

::: worked-example {id="example" concept="inputs"}
A mango tree stands in the sun after rain.

1. **Water** travels up from the roots through the stem.
2. **Carbon dioxide** enters the leaf through tiny pores.
3. **Sunlight** is caught by chlorophyll.
4. The leaf makes **sugar** for the tree and releases **oxygen** for us.
:::

::: hints {id="hints" concept="inputs"}
1. Think about what the roots take from the soil.
2. Plants breathe in a gas that we breathe out.
3. The energy comes from something in the sky.
:::

::: check {id="check-inputs" concept="inputs" explain="Water, carbon dioxide, and sunlight go in; sugar and oxygen come out."}
Which of these does a plant NOT need to make food?

- [ ] Sunlight
- [ ] Water
- [x] Soil insects
- [ ] Carbon dioxide
:::

::: remediation {id="review-roots" for="leaves"}
Roots take in water and minerals, but they cannot make food because they have no chlorophyll and get no sunlight. Food is made in the leaves.
:::

::: practice {id="practice" concept="leaves"}
Find two plants near your home. Is one greener than the other? Write one sentence about which might make more food and why.
:::

::: checkpoint {id="checkpoint"}
- [ ] I can name the plant part that makes food.
- [ ] I can list the three things a plant needs for photosynthesis.
:::
`;

const fractionsLesson = `---
pavo: adaptive-lesson
schemaVersion: 1
lessonId: demo-adding-fractions
title: Adding dissimilar fractions
gradeLevel: 5
subject: Mathematics
competencies: M5NS-Ic-1
estimatedMinutes: 25
language: en
---

::: objective {id="objective"}
Add two fractions with different denominators by first finding a common denominator.
:::

::: concept {id="common" concept="common-denominator"}
You can only add pieces of the **same size**. Halves and thirds are different sizes, so first cut both into sixths. That shared size is the **least common denominator** (LCD).
:::

::: worked-example {id="example" concept="common-denominator"}
**1/2 + 1/3**

1. The LCD of 2 and 3 is 6.
2. 1/2 = 3/6 and 1/3 = 2/6.
3. 3/6 + 2/6 = **5/6**.
:::

::: hints {id="hints" concept="common-denominator"}
1. List the multiples of each denominator.
2. The first number on both lists is the LCD.
3. Multiply top and bottom by the same number to rename each fraction.
:::

::: check {id="check-lcd" concept="common-denominator" explain="Never add the denominators. Rename both fractions in fourths: 2/4 + 1/4 = 3/4."}
What is 1/2 + 1/4?

- [ ] 2/6
- [x] 3/4
- [ ] 2/4
:::

::: remediation {id="review-denominators" for="common-denominator"}
Adding 1/2 + 1/4 to get 2/6 means the denominators were added. The bottom number names the size of the piece, so it never gets added. Rename first, then add only the tops.
:::

::: checkpoint {id="checkpoint"}
- [ ] I can find the LCD of two denominators.
- [ ] I can add two dissimilar fractions and simplify the answer.
:::
`;

const agreementLesson = `---
pavo: adaptive-lesson
schemaVersion: 1
lessonId: demo-subject-verb
title: Subject–verb agreement
gradeLevel: 5
subject: English
competencies: EN5G-IIIa-1
estimatedMinutes: 15
language: en
---

::: objective {id="objective"}
Choose the verb form that agrees with a singular or plural subject.
:::

::: concept {id="rule" concept="agreement"}
A **singular** subject takes a verb ending in *-s*: *The dog barks.* A **plural** subject takes the base form: *The dogs bark.*
:::

::: check {id="check" concept="agreement" explain="Children is plural, so the verb is play."}
The children ___ in the yard.

- [x] play
- [ ] plays
:::

::: checkpoint {id="checkpoint"}
- [ ] I can match a verb to a singular or plural subject.
:::
`;

const plantsQuestions: AssessmentQuestion[] = [
  q({
    id: 'leaf',
    kind: 'multiple_choice',
    prompt: 'Which part of the plant makes food?',
    choices: ['Root', 'Leaf', 'Stem', 'Flower'],
    answer: 'Leaf',
    topic: 'Plant parts',
    competency: 'S5LT-IIa-1',
    difficulty: 'easy',
    rationale: 'Leaves hold chlorophyll and receive sunlight.',
    misconception: 'Believes roots make food because they absorb nutrients.',
    intervention: 'Contrast absorbing water (roots) with making sugar (leaves).',
    remediationRef: 'adaptive-lesson#review-roots',
  }),
  q({
    id: 'pigment',
    kind: 'fill_in_the_blank',
    prompt: 'The green pigment in leaves that catches sunlight is ___.',
    answer: 'chlorophyll',
    topic: 'Plant parts',
    competency: 'S5LT-IIa-1',
    rationale: 'Chlorophyll absorbs light energy.',
  }),
  q({
    id: 'sunlight',
    kind: 'true_false',
    prompt: 'A plant kept in a dark cabinet for weeks can still make food normally.',
    answer: 'False',
    topic: 'Photosynthesis',
    competency: 'S5LT-IIa-2',
    rationale: 'Photosynthesis needs light energy.',
    misconception: 'Thinks water alone is enough for a plant to make food.',
    intervention: 'Run the dark-cabinet bean comparison over one week.',
  }),
  q({
    id: 'gas-in',
    kind: 'multiple_choice',
    prompt: 'Which gas does a leaf take in to make food?',
    choices: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Helium'],
    answer: 'Carbon dioxide',
    topic: 'Photosynthesis',
    competency: 'S5LT-IIa-2',
    difficulty: 'hard',
    rationale: 'Leaves take in carbon dioxide and release oxygen.',
    misconception: 'Swaps the gases: thinks plants breathe in oxygen to make food.',
    intervention: 'Trace one breath: we exhale carbon dioxide, the leaf uses it, and returns oxygen.',
  }),
  q({
    id: 'gas-out',
    kind: 'identification',
    prompt: 'Name the gas plants give off during photosynthesis.',
    answer: 'Oxygen',
    acceptedAnswers: ['O2'],
    topic: 'Photosynthesis',
    competency: 'S5LT-IIa-2',
    points: 2,
    rationale: 'Oxygen is released as a by-product.',
  }),
  q({
    id: 'stem',
    kind: 'multiple_choice',
    prompt: 'What is the main job of the stem?',
    choices: ['Make seeds', 'Carry water and food', 'Catch sunlight', 'Hold the soil'],
    answer: 'Carry water and food',
    topic: 'Plant parts',
    competency: 'S5LT-IIa-1',
    difficulty: 'easy',
  }),
];

const fractionPairs: Array<[string, string, string[]]> = [
  ['1/2 + 1/3', '5/6', ['2/5', '5/6', '1/6', '2/6']],
  ['1/4 + 1/2', '3/4', ['2/6', '3/4', '1/8', '2/4']],
  ['2/3 + 1/6', '5/6', ['3/9', '5/6', '3/6', '1/2']],
  ['1/5 + 1/2', '7/10', ['2/7', '7/10', '3/10', '1/10']],
  ['3/8 + 1/4', '5/8', ['4/12', '5/8', '4/8', '1/2']],
  ['1/3 + 1/4', '7/12', ['2/7', '7/12', '1/12', '5/12']],
  ['1/6 + 1/3', '1/2', ['2/9', '1/2', '1/3', '2/6']],
  ['2/5 + 3/10', '7/10', ['5/15', '7/10', '1/2', '6/10']],
  ['1/2 + 3/8', '7/8', ['4/10', '7/8', '5/8', '3/4']],
  ['5/12 + 1/4', '2/3', ['6/16', '2/3', '7/12', '1/2']],
];

const FRACTION_MISCONCEPTIONS: Array<[string, string]> = [
  ['Adds numerators and denominators straight across.', 'Use fraction strips to show that halves and thirds are different-sized pieces.'],
  ['Finds a common denominator but forgets to rename the numerators.', 'Practise "what you do to the bottom, do to the top" with three paired examples.'],
  ['Picks a common denominator that is not the least one, then miscounts.', 'List multiples side by side and circle the first match before adding.'],
  ['Stops before simplifying the sum.', 'End every sum by checking for a common factor of the top and bottom.'],
];

const fractionQuestions: AssessmentQuestion[] = fractionPairs.map(([sum, answer, choices], index) =>
  q({
    id: `add-${index + 1}`,
    kind: 'multiple_choice',
    prompt: `What is ${sum}?`,
    choices,
    answer,
    topic: index < 5 ? 'Common denominators' : 'Simplifying sums',
    competency: 'M5NS-Ic-1',
    difficulty: index < 3 ? 'easy' : index < 7 ? 'medium' : 'hard',
    rationale: `Rename both fractions with the least common denominator, add the numerators, then simplify to ${answer}.`,
    misconception: FRACTION_MISCONCEPTIONS[index % FRACTION_MISCONCEPTIONS.length]![0],
    intervention: FRACTION_MISCONCEPTIONS[index % FRACTION_MISCONCEPTIONS.length]![1],
    remediationRef: 'adaptive-lesson#review-denominators',
  }),
);

export const DEMO_PACKAGES: DemoPackage[] = [
  {
    id: 'demo-plants-make-food',
    title: 'How plants make food',
    gradeLevel: 5,
    subject: 'Science',
    competencies: ['S5LT-IIa-1', 'S5LT-IIa-2'],
    lesson: parseAdaptiveLesson(plantsLesson),
    quiz: {
      quizId: 'demo-plants-check',
      version: 1,
      mode: 'digital_mini_quiz',
      title: 'Plants make food: mini-quiz',
      gradeLevel: 5,
      subject: 'Science',
      questions: plantsQuestions,
      policy: { ...DEFAULT_QUIZ_POLICY, timeLimitMinutes: 10 },
      templateId: 'pavo-std-20x4',
      alternateForms: 0,
      retainScanImages: false,
      masterKey: null,
      forms: null,
    },
  },
  {
    id: 'demo-adding-fractions',
    title: 'Adding dissimilar fractions',
    gradeLevel: 5,
    subject: 'Mathematics',
    competencies: ['M5NS-Ic-1'],
    lesson: parseAdaptiveLesson(fractionsLesson),
    quiz: {
      quizId: 'demo-fractions-paper',
      version: 1,
      mode: 'paper_omr',
      title: 'Adding fractions: paper quiz',
      gradeLevel: 5,
      subject: 'Mathematics',
      questions: fractionQuestions,
      policy: DEFAULT_QUIZ_POLICY,
      templateId: 'pavo-std-20x4',
      alternateForms: 1,
      retainScanImages: false,
      masterKey: null,
      forms: null,
    },
  },
  {
    id: 'demo-subject-verb',
    title: 'Subject–verb agreement',
    gradeLevel: 5,
    subject: 'English',
    competencies: ['EN5G-IIIa-1'],
    lesson: parseAdaptiveLesson(agreementLesson),
    quiz: null,
  },
];

/**
 * Deterministic demo responses: each learner answers correctly with roughly
 * their `skill` probability, and wrong answers favour each question's first
 * distractor so the misconception analytics have a visible pattern.
 */
export function demoResponses(
  questions: AssessmentQuestion[],
  skill: number,
  seed: number,
): Record<string, string> {
  let state = seed >>> 0;
  const random = () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
  return Object.fromEntries(
    questions.map((question) => {
      const roll = random();
      if (roll < skill) return [question.id, question.answer];
      if (roll > 0.94) return [question.id, ''];
      const wrong = question.choices.filter((choice) => choice !== question.answer);
      return [question.id, wrong[0] ?? (question.answer === 'Oxygen' ? 'Carbon dioxide' : 'I am not sure')];
    }),
  );
}
