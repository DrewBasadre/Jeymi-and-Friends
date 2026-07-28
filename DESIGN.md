# WAIS Design System

This document describes the visual language currently implemented in the WAIS
Android app. The system is designed for Grade 5 learners and teachers: warm,
readable, offline-friendly, and structured enough for repeated classroom use.

## Visual Direction

- Name: Scholar Indigo
- Mood: tactile, friendly, classroom-ready, and lightly premium
- Primary audience: Grade 5 learners and elementary teachers
- Mode: light theme only
- Accessibility goal: generous spacing, large touch targets, readable body text,
  and clear status language

## Color Palette

| Token | Hex | Role |
| --- | --- | --- |
| `Indigo500` | `#4F46E5` | Primary actions, active tabs, buttons |
| `Indigo600` | `#3525CD` | Pressed primary state |
| `Indigo900` | `#1E1B4B` | Deep heading text |
| `Amber500` | `#F59E0B` | Achievement and Math accent |
| `Emerald500` | `#10B981` | Success and English accent |
| `Surface` | `#FAF9F6` | Warm app background |
| `SurfaceLow` | `#F4F3F1` | Section backgrounds |
| `SurfaceLowest` | `#FFFFFF` | Card backgrounds |
| `OnSurface` | `#1A1C1A` | Primary text |
| `OnSurfaceVariant` | `#464555` | Secondary text |
| `OutlineVariant` | `#C7C4D8` | Borders and separators |

## Subject Colors

| Subject | Accent | Background |
| --- | --- | --- |
| Science | `Indigo500 #4F46E5` | `#EEF2FF` |
| Math | `Amber500 #F59E0B` | `#FFFBEB` |
| English | `Emerald500 #10B981` | `#ECFDF5` |

## Status Chips

| Status | Background | Text |
| --- | --- | --- |
| Completed | `#D1FAE5` | `#059669` |
| In Progress | `#FEF3C7` | `#92400E` |
| Not Started | `#E9E8E5` | `#464555` |

## Typography

- Headlines: Plus Jakarta Sans when available, otherwise the system default.
- Body: Inter when available, otherwise the system default.
- Labels and compact codes: Space Grotesk when available, otherwise monospace.
- Display heading: 36sp bold.
- Large heading: 28sp bold.
- Medium heading: 22sp semibold.
- Body: 16sp with 24sp line height.
- MELC and lesson labels: 13sp semibold with added letter spacing.

## Components

Buttons:

- Primary buttons use an indigo fill, white text, pill shape, and a 48dp minimum
  height.
- Secondary buttons use a white fill, indigo outline, and indigo text.
- Disabled states use muted surfaces and secondary text.

Cards:

- Cards use 16dp corners and low elevation.
- Module cards use a subject accent border and switch to a muted surface when
  completed.
- Metric cards use subject or status tints with a large numeric value.

Inputs:

- Text fields use 12dp corners.
- Focus states use the primary indigo outline and label color.

Navigation:

- Bottom navigation uses a white surface with indigo active states.
- Teacher navigation is task-oriented: Record Book, Scanner, Gurobot, and
  Student View.
- Student navigation is learner-oriented: Modules, QR Code, and Profile.

## Layout Principles

- Spacing scale: 4, 8, 12, 16, 20, 24, and 32dp.
- Standard horizontal margin: 20dp.
- Minimum touch target: 48dp.
- Lists and cards use 12dp gaps.
- Screens prioritize the active workflow instead of marketing copy.

## Implemented Files

- `ui/theme/Color.kt` - palette, spacing, elevation, and shape tokens.
- `ui/theme/Typography.kt` - type scale.
- `ui/theme/Theme.kt` - Material 3 color scheme and app theme.
- `ui/screens/DesignSystem.kt` - shared atoms such as `StatusChip`,
  `HubMetricCard`, `HubPrimaryButton`, `AppBrandHeader`, and analysis cards.
- `ui/screens/Screens.kt` - role, login, student, teacher, QR, module, quiz, and
  Gurobot screens.

## Screen Coverage

- Role selection
- Student login and profile creation
- Teacher login
- Student dashboard
- Module library
- Digital lesson reader
- Quiz and quiz result flow
- Student QR code tab
- Student profile tab
- Teacher dashboard
- Record book
- Individual student performance
- Gurobot lesson generator
- Lesson plan library
- Teacher scanner
- Teacher student-view mode
