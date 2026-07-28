# Pavo Design System — "Peacock"

Pavo is an offline-first learning app for students, teachers, and parents.
Its visual language is drawn from peacock plumage: a green–blue core with a
warm gold accent. The feel is friendly and encouraging for students, yet
genuinely well-designed — a real product, not a children's toy or a generic
template.

**Single source of truth:** `mobile/src/theme/tokens.ts`. Do not hard-code
colors, sizes, or shadows in screens — import tokens. New code should prefer
the semantic names (`primary`, `secondary`, `accent`, `success`…). Legacy
names (`indigo`, `emerald`, `amber`) still exist but are remapped to peacock
values for backward compatibility.

Platform: React Native (Expo), `StyleSheet` + tokens. Light theme only.
Mobile-first (students are on phones).

---

## Color

### Brand
| Token | Hex | Role | Contrast on white |
| --- | --- | --- | --- |
| `primary` | `#0F766E` | Deep teal — primary actions, active tabs | 5.1:1 ✅ |
| `primaryPressed` | `#115E59` | Pressed primary | — |
| `primaryTint` | `#DCF0EC` | Teal wash — icon chips, ghost buttons, active tab pill | — |
| `secondary` | `#0E6B93` | Ocean blue — secondary emphasis, info | 5.5:1 ✅ |
| `secondaryTint` | `#DDEDF4` | Blue wash | — |
| `accent` | `#E0A11B` | Peacock-eye gold — highlights **only**, used sparingly | fills |
| `accentText` | `#8A5B00` | Gold-family text on white | 4.6:1 ✅ |
| `accentTint` | `#FBEED1` | Gold wash | — |

**Iridescent gradient** (`gradientStart #12A594` → `gradientEnd #0E6B93`):
teal→ocean-blue, used for progress bars and the mascot's plumage.

### Semantic
`success #0E8A5F` · `warning #B45309` · `error #C0392B` · `info #0E6B93`,
each with a matching `*Tint`. Status chips use `statusPalette`
(completed / inProgress / notStarted / locked) with AA-checked bg+fg pairs.

### Neutral ramp (lightly teal-tinted slate)
`n0 #FFFFFF` → `n900 #0F2A28`. Text: `ink #0F2A28` (headings),
`inkMuted #4C5F5C` (body/secondary, AA on white and mint), `inkSubtle #647A75`.
Surfaces: `background #F2F8F5` (light mint), `surface #FFFFFF`,
`surfaceMuted #E9F1ED`, `surfaceSunken #E1EDE8`. Borders: `outline #CDDDD6`.

### Subjects
Science = teal · Math = gold · English = emerald · Reading = ocean blue.

---

## Typography

System font (no custom font ships — keeps the native build lean). One scale,
imported as `text.*` and spread into styles:

| Token | Size / Line | Weight | Use |
| --- | --- | --- | --- |
| `display` | 32 / 38 | 800 | Hero brand |
| `h1` | 27 / 33 | 800 | Screen titles |
| `h2` | 22 / 28 | 800 | Section titles |
| `title` | 18 / 24 | 700 | Card titles |
| `bodyStrong` | 16 / 24 | 700 | Emphasis / buttons |
| `body` | 16 / 24 | 400 | Body copy |
| `label` | 14 / 20 | 600 | Labels, chips |
| `caption` | 13 / 18 | 600 | Meta, secondary |
| `overline` | 12 / 16 | 800, +0.8 tracking | Eyebrow labels (uppercased) |
| `metric` | 28 / 32 | 800 | Big numbers |

---

## Spacing, radii, elevation, motion

- **Spacing** (`spacing.*`): 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40.
- **Radii** (`radius.*`): `sm 8` · `md 12` (buttons/inputs) · `lg 16` (cards) ·
  `xl 24` (hero/flashcards) · `round 999`. Lean rounded for friendliness.
- **Elevation** (`elevation.*`): `e1` resting cards, `e2` raised/interactive,
  `e3` sheets/celebrations — soft, teal-tinted shadows (iOS shadow + Android
  elevation).
- **Motion** (`motion.*`): durations `fast 120 / base 200 / slow 320 /
  celebrate 900` ms; standard & decelerate easings; a spring config.
  All motion respects `AccessibilityInfo.isReduceMotionEnabled()`.

---

## Components (`mobile/src/components/ui.tsx`)

- **Screen** — safe-area-aware scroll container (fixes notch/gesture-bar
  overlap everywhere). Never add manual top padding for the status bar.
- **ScreenHeader** — title + optional overline/subtitle + back + action slot.
- **Card** / **CardHeader** — elevated rounded surface; header = icon-chip +
  title + subtitle, replaces the per-screen title rows.
- **PrimaryButton** — tones `primary | secondary | ghost | accent | danger`,
  sizes `sm | md`, optional icon, loading + selection haptics. Use `ghost`/`sm`
  for tertiary actions so hierarchy reads clearly.
- **Chip** — interactive filter (pill) vs. static (muted, non-pressable).
- **StatusBadge** — dot + label from `statusPalette`.
- **Metric** — big number + label on a tint.
- **ProgressBar** — animated teal→blue gradient (value 0–1), AA progressbar
  a11y role.
- **Skeleton / SkeletonCard** — reduced-motion-aware loading placeholders
  (replace `'Loading…'` strings and `?? 0` fake zeros).
- **EmptyState / LoadingScreen** — mascot-powered, encouraging.

## Mascot (`mobile/src/components/mascot/`)

Pavo the peacock is a warm guide, not decoration. Centralized SVG so real art
can drop in later.

- **Peacock** — inline SVG, expressions `idle | happy | encouraging`.
- **MascotPanel** — peacock in a tinted halo + title/body; gentle idle bob
  (reduced-motion-aware). Used in onboarding, empty states, encouragement.
- **Celebrate** — skippable, non-blocking confetti burst for completion
  moments; fully suppressed under reduced motion.

Use the mascot at: onboarding/role choice, empty states, and small
celebrations (quiz complete, module finished). Keep gold sparing.

---

## Accessibility

- Touch targets ≥ 44pt (buttons 52 / sm 42, icon buttons 48).
- Text pairs meet WCAG 2.1 AA (4.5:1 body, 3:1 large).
- `accessibilityRole` / `accessibilityLabel` / `accessibilityState` on
  interactive elements; `progressbar` role on ProgressBar.
- All animation honors reduced-motion.

## Guardrails

- Light theme only; don't introduce new styling paradigms or a 2nd font family.
- Don't touch backend/data/domain/services or API shapes.
- Avoid neon-on-white, purple-blue "AI" gradients, cramped layouts, and
  over-gamified game systems — polish is look-and-feel + micro-delight only.
