package com.pangarap.learninghub.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// ── Peacock palette ───────────────────────────────────────────────────────────
// A green–blue identity drawn from peacock plumage: deep teal primary, emerald
// tail-green, ocean-blue, and a warm gold accent (the eye-spots / ocelli).
// The legacy `Indigo*` names are kept but now hold peacock TEAL values so every
// existing screen re-skins without touching a single reference.
val Indigo50  = Color(0xFFECF6F3) // very light teal wash
val Indigo100 = Color(0xFFDCF0EC) // light teal — primary container
val Indigo200 = Color(0xFFB7D9D2)
val Indigo500 = Color(0xFF0F766E) // primary — deep teal (5.1:1 on white)
val Indigo600 = Color(0xFF115E59) // pressed
val Indigo900 = Color(0xFF0F2A28) // deep teal-slate — headings / onPrimaryContainer

// Gold accent (peacock eye-spots) — reserved for highlights & active states.
val Amber50   = Color(0xFFFDF6E3)
val Amber100  = Color(0xFFFBEED1)
val Amber400  = Color(0xFFEBB93E)
val Amber500  = Color(0xFFE0A11B)

// Emerald tail-green.
val Emerald50  = Color(0xFFE9F7EF)
val Emerald100 = Color(0xFFD6F3E4)
val Emerald500 = Color(0xFF0E8A5F)
val Emerald600 = Color(0xFF0A6E4C)

// Ocean blue (neck + body) — used by the mascot and blue accents.
val Ocean100 = Color(0xFFDDEDF4)
val Ocean500 = Color(0xFF0E6B93)
val Ocean900 = Color(0xFF0B5474)

// Iridescent gradient (teal → ocean) for progress & plumage.
val TealBright  = Color(0xFF12A594)
val GradientEnd = Color(0xFF0E6B93)

// Mascot base colours.
val CreamChick = Color(0xFFF4EAD1)
val AccentText = Color(0xFF8A5B00)

// ── Surfaces ──────────────────────────────────────────────────────────────────
val Surface         = Color(0xFFF2F8F5) // soft light-mint app background
val SurfaceLow      = Color(0xFFE9F1ED)
val SurfaceLowest   = Color(0xFFFFFFFF)
val SurfaceHigh     = Color(0xFFE1EDE8)
val SurfaceHighest  = Color(0xFFD9E7E1)
val SurfaceDim      = Color(0xFFCFE0D9)

// ── On-colors ─────────────────────────────────────────────────────────────────
val OnSurface         = Color(0xFF0F2A28)
val OnSurfaceVariant  = Color(0xFF4C5F5C)
val OnPrimary         = Color(0xFFFFFFFF)

// ── Outline ───────────────────────────────────────────────────────────────────
val Outline        = Color(0xFF6E8A84)
val OutlineVariant = Color(0xFFCDDDD6)

// ── Error ─────────────────────────────────────────────────────────────────────
val ErrorContainer   = Color(0xFFFBE4E0)
val OnErrorContainer = Color(0xFF7A271A)

// ── Subject accents ───────────────────────────────────────────────────────────
val SubjectScienceBg     = Color(0xFFDCF0EC)
val SubjectMathBg        = Color(0xFFFBEED1)
val SubjectEnglishBg     = Color(0xFFD6F3E4)
val SubjectScienceBorder = Indigo500
val SubjectMathBorder    = Amber500
val SubjectEnglishBorder = Emerald500

// ── Status chips ──────────────────────────────────────────────────────────────
val ChipCompletedBg    = Emerald100
val ChipCompletedText  = Emerald600
val ChipInProgressBg   = Amber100
val ChipInProgressText = AccentText
val ChipNotStartedBg   = SurfaceHigh
val ChipNotStartedText = OnSurfaceVariant

// ── Metric card pastels ───────────────────────────────────────────────────────
val MetricBlueBg   = Ocean100
val MetricGreenBg  = Emerald100
val MetricAmberBg  = Amber100
val MetricPurpleBg = Indigo100

// ── Spacing tokens ────────────────────────────────────────────────────────────
val SpacingXs  = 4.dp
val SpacingSm  = 8.dp
val SpacingMd  = 12.dp
val SpacingLg  = 16.dp
val SpacingXl  = 20.dp
val SpacingXxl = 24.dp
val SpacingGap = 32.dp

// ── Elevation tokens ──────────────────────────────────────────────────────────
val ElevationCard  = 2.dp
val ElevationFloat = 6.dp

// ── Shape tokens ──────────────────────────────────────────────────────────────
val ShapeCard   = RoundedCornerShape(16.dp)
val ShapeInput  = RoundedCornerShape(12.dp)
val ShapeChip   = RoundedCornerShape(50.dp)
val ShapeButton = RoundedCornerShape(16.dp)
val ShapeSheet  = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
