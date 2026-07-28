# Pavo Design System — "Peacock"

Pavo is an offline-first learning app for students, teachers, and parents.
Its visual language is drawn from peacock plumage: a green–blue core with a
warm gold accent. The target feel is a **high-end academic learning
companion** — structured, calm, and credible enough for a teacher, with
enough warmth and earned progression to keep a student coming back. It is
not a children's toy, not a generic template, and not an arcade.

**Single source of truth:** `mobile/src/theme/tokens.ts`. Do not hard-code
colors, sizes, or shadows in screens — import tokens. New code should prefer
the semantic names (`primary`, `secondary`, `accent`, `success`…). Legacy
names (`indigo`, `emerald`, `amber`) still exist but are remapped to peacock
values for backward compatibility.

Platform: React Native (Expo), `StyleSheet` + tokens. Light theme only.
Mobile-first (students are on phones), responsive up to tablet.

---

## Color

### Brand
| Token | Hex | Role | Contrast on white |
| --- | --- | --- | --- |
| `primary` | `#0F766E` | Deep teal — primary actions, active tabs | 5.1:1 ✅ |
| `primaryPressed` | `#115E59` | Pressed primary | — |
| `primaryTint` | `#DCF0EC` | Teal wash — icon plates, ghost buttons, active tab pill | — |
| `secondary` | `#0E6B93` | Ocean blue — secondary emphasis, info | 5.5:1 ✅ |
| `secondaryTint` | `#DDEDF4` | Blue wash | — |
| `accent` | `#E0A11B` | Peacock-eye gold — highlights **only**, used sparingly | fills |
| `accentText` | `#8A5B00` | Gold-family text on white | 4.6:1 ✅ |
| `accentTint` | `#FBEED1` | Gold wash | — |

### On-brand & deep surfaces
Text and panels that sit on a gradient or teal surface use dedicated tokens —
**never inline `rgba(255,255,255,…)`**: `onBrand`, `onBrandMuted`,
`onBrandSubtle`, `onBrandSurface` (inset panel), `onBrandLine` (rule / track).
Deep surfaces: `canopy #0B3A38`, `canopyDeep #072B2A`, `scrim` (camera and
sheet overlays).

### Gradients (`gradients.*`)
Drawn with `react-native-svg` through `GradientView` — no extra dependency.
`brand` (teal→ocean, progress + brand marks) · `hero` (rich teal descent,
hero cards) · `night` (focus surfaces) · `gold` (level and achievement bars) ·
`ocean` · plus one ramp per subject (`science`, `math`, `english`, `reading`,
`added`).

### Semantic
`success #0E8A5F` · `warning #B45309` · `error #C0392B` · `info #0E6B93`,
each with a matching `*Tint`. Status chips use `statusPalette`
(completed / inProgress / notStarted / locked) with AA-checked bg+fg pairs.

### Neutral ramp (lightly teal-tinted slate)
`n0 #FFFFFF` → `n900 #0F2A28`. Text: `ink #0F2A28` (headings),
`inkMuted #4C5F5C` (body/secondary, AA on white and mint), `inkSubtle #647A75`.
Surfaces: `background #F2F8F5` (light mint), `surface #FFFFFF`,
`surfaceMuted #E9F1ED`, `surfaceSunken #E1EDE8`. Rules: `outline #CDDDD6`
between surfaces, `hairline #E2EDE8` **inside** a card.

### Subjects
Science = teal · Math = gold · English = emerald · Reading = ocean blue.
Each subject also has `subjectTint` (wash) and `subjectGradient` (ramp).

---

## Typography

System font (no custom font ships — keeps the native build lean). Headings
carry a slight **negative tracking**: an optical correction that makes large
system text read tight and editorial instead of loose and default. It is the
cheapest single lever for a designed feel.

| Token | Size / Line | Weight | Tracking | Use |
| --- | --- | --- | --- | --- |
| `hero` | 40 / 45 | 800 | −1.0 | Landing wordmark |
| `display` | 32 / 38 | 800 | −0.7 | Hero brand |
| `h1` | 27 / 33 | 800 | −0.5 | Screen titles |
| `h2` | 22 / 28 | 800 | −0.35 | Section titles |
| `title` | 18 / 24 | 700 | −0.2 | Card titles |
| `bodyStrong` | 16 / 24 | 700 | −0.1 | Emphasis / buttons |
| `body` | 16 / 24 | 400 | — | Body copy |
| `bodySm` | 15 / 22 | 400 | — | Dense body |
| `label` | 14 / 20 | 600 | — | Labels, chips |
| `caption` | 13 / 18 | 600 | — | Meta, secondary |
| `tiny` | 11 / 15 | 700 | — | Badge and tag text |
| `overline` | 12 / 16 | 800 | +0.8 | Eyebrow labels (uppercased) |
| `metric` | 28 / 32 | 800 | −0.6 | Stat-tile numbers |
| `numeral` | 44 / 48 | 800 | −1.4 | Score / level headline numbers |

**Lesson body copy is deliberately larger** than UI copy: `ModuleMarkdown`
sets 17/29. Reading is the core act of the app.

---

## Spacing, radii, elevation, motion, layout

- **Spacing** (`spacing.*`): 4 · 8 · 12 · 16 · 20 · 24 · 32 · 40.
- **Radii** (`radius.*`): `xs 6` · `sm 8` · `md 12` (buttons/inputs) ·
  `lg 16` (cards) · `xl 24` (flashcards) · `xxl 28` (hero) · `round 999`.
- **Elevation** (`elevation.*`): `e0` hairline lift (tiles, chips) · `e1`
  resting cards · `e2` raised/interactive · `e3` sheets/celebrations ·
  `glow` warm gold halo for **earned** elements only.
- **Motion** (`motion.*`): durations `fast 120 / base 200 / slow 320 /
  celebrate 900` ms; standard & decelerate easings; a spring config.
  All motion respects `AccessibilityInfo.isReduceMotionEnabled()`.
- **Layout** (`layout.*`): `maxContentWidth 760` · `gutter 20` ·
  `tabBarHeight 62` · `tabBarClearance 96`.

---

## Components (`mobile/src/components/ui.tsx`)

**Layout** — `Screen` (safe-area-aware scroll container; never add manual
status-bar padding — pass `padded={false}` when the screen hosts its own
`FlatList`, or the gutter is applied twice), `TileGrid`, `Row`, `Divider`,
`useResponsiveColumns()`, `useCompactViewport()`.

> **Use `TileGrid`, not `flexWrap`, for tile grids.** A wrapping row of
> `flex: 1` items produces unpredictable item heights and can overlap the next
> section. `TileGrid` chunks children into explicit rows of `columns` and pads
> a short final row so column widths stay stable.

**Surfaces** — `Card` / `CardHeader` (icon plate → title → subtitle → action),
`HeroCard` (full-bleed gradient anchor, **at most one per screen**),
`GradientView` (SVG gradient surface), `IconPlate` (tinted icon square),
`Callout` (info / success / warning / error notice — replaces ad-hoc red text).

**Structure** — `ScreenHeader` (overline + title + subtitle + back + action),
`SectionHeader` (title + caption + trailing link), `SectionTitle`.

**Controls** — `PrimaryButton` (tones `primary | secondary | ghost | accent |
danger`, sizes `sm | md`), `IconButton`, `Chip` (sizes `sm | md`),
`SegmentedControl`, `ListRow`, `ActionTile` (quick-action grid tile with an
optional count badge), `PressableScale` (press-scale wrapper — the one
micro-interaction that makes card lists feel like a product).

**Data** — `StatusBadge`, `Metric`, `StatTile` (icon + value + label +
footnote), `ProgressBar` (animated, any gradient ramp), `RingProgress`
(animated circular progress with a slot in the middle).

**States** — `Skeleton` / `SkeletonCard` (reduced-motion aware; replace
`'Loading…'` strings and `?? 0` fake zeros), `EmptyState`, `LoadingScreen`.

## Mascot — 5-phase growth peacock (`mobile/src/components/mascot/`)

Pavo the peacock is a warm guide **and** a progression indicator. It's crisp
pixel art (axis-aligned `<Rect>` on integer coords, flat fills — no gradients,
no anti-aliasing) and grows through **5 phases** as the learner progresses.
Centralized + swappable: `PeacockPhase.tsx` is the single source of mascot art;
real sprites can replace the draw functions without touching callers.

| Phase | Name | Look |
| --- | --- | --- |
| 1 | Hatchling | Small cream chick, no tail |
| 2 | Fledgling | Teal starting, tiny tail nubs |
| 3 | Plumed | Teal body, small fan with gold ocelli |
| 4 | Brilliant | Fuller fan, rosy cheeks |
| 5 | Radiant | Full iridescent 7-feather display + sparkles |

- **`peacockPhase({ completedModules, totalModules, averageScore })`** derives
  the phase from **real progress** (completion weighted 0.6, mastery 0.4).
  `peacockPhaseFromScore(score)` is the compact variant for roster rows.
- **MascotPanel** — pixel peacock in a tinted halo + title/body; gentle idle
  bob (reduced-motion-aware). Used in onboarding, empty/loading/error states.
- **Celebrate** — skippable, non-blocking confetti burst for completion
  moments; fully suppressed under reduced motion.

## Progression & gamification

Gamification here is **academic, not arcade**, and it is never faked. Every
number is derived at render time from data the app already has — see
`mobile/src/utils/progression.ts` (unit-tested in
`mobile/__tests__/progression.test.ts`). If the backend later ships
authoritative progression fields, replace those functions; callers keep working.

- **Study points** — `completedModules × 100 + attempts × 20 + averageScore`.
  Transparent on purpose: a learner can explain their own total.
- **Levels & ranks** — level *n* costs `300 + (n−1) × 150` points. Rank bands
  are scholarly: Novice → Apprentice → Scholar → Adept → Luminary.
- **Milestones** — eight badges (`first lesson`, `five deep`, `halfway`,
  `full sweep`, `sharp`, `mastery`, `persistent`, `cards clear`). Locked
  badges stay visible but muted: an invitation, not a scoreboard. A badge can
  never light up for something the learner has not actually done.
- **`LearnerHero`** (`components/LearnerHero.tsx`) — the home anchor: the
  growth peacock inside a gold level ring, rank + phase, a headline drawn from
  real state, 5 growth pips, and a level-progress panel.
- **`MilestoneStrip`** (`components/Milestones.tsx`) — horizontal badge strip,
  earned first.

Keep gold sparing: it marks **earned** things (levels, milestones, mastery)
and nothing else.

## Dates & text rules

- **One date utility** — `mobile/src/utils/format.ts`. Every user-facing date
  goes through `formatDate` → **"January 26, 2026"**; deadlines use
  `formatDeadline` → **"Due January 26, 2026"**; ranges use `formatDateRange`.
  Never show raw ISO or `01/26/26`.
- **Capitalization** — **Sentence case everywhere**: headings, section titles,
  card titles, buttons, labels and body. Only the brand ("Pavo"), proper nouns
  and acronyms (QR, PIN, Nearby, Gurobot, subject names) keep their capitals.
  Every visible string still starts capitalized. Title Case reads dated and
  shouty at this scale — "Show report QR", not "Show Report QR".
- **Spelling** — US English (practice, summarize, recognize).
- **Punctuation** — em dashes in prose, not hyphens.

## Cards & layout

- **One card system** — `Card` (elevated, rounded, `radius.lg`) + `CardHeader`.
  Structured content order: header → key info → progress/meta → deadline →
  **action footer**. The module card is the reference implementation: subject
  spine → subject tag → title → competency code → summary → style tags →
  "Open lesson →".
- **Screen rhythm** — one `HeroCard` at most, then quick actions, then
  time-sensitive content, then supporting detail, then progress and
  milestones. `SectionHeader` separates the movements so a long screen reads
  as an edited page rather than a stack of cards.
- **Space-maximizing & responsive** — `Screen` caps content at
  `layout.maxContentWidth` centered so wide screens don't stretch text.
  `useResponsiveColumns()` returns 1 / 2 / 3 columns by viewport width; card
  lists (Modules, Record book) fill the space as a grid on tablet instead of
  leaving empty gutters.

---

## Accessibility

- Touch targets ≥ 44pt (buttons 54 / sm 42, icon buttons 48).
- Text pairs meet WCAG 2.1 AA (4.5:1 body, 3:1 large).
- `accessibilityRole` / `accessibilityLabel` / `accessibilityState` on
  interactive elements; `progressbar` role on `ProgressBar` and `RingProgress`.
- Milestone badges announce earned/locked state and their unlock condition.
- All animation honors reduced-motion.

## Guardrails

- Light theme only; don't introduce new styling paradigms or a 2nd font family.
- Don't touch backend/data/domain/services or API shapes. Progression is
  derived in `utils/progression.ts` — never persisted, never invented.
- Avoid neon-on-white, purple-blue "AI" gradients, cramped layouts, and
  over-gamified game systems (no coins, no default leaderboards, no streak
  guilt). Polish is look-and-feel + micro-delight only.
