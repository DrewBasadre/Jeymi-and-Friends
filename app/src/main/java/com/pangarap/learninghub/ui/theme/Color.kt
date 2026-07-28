package com.pangarap.learninghub.ui.theme

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// ── Scholar Indigo palette ────────────────────────────────────────────────────
val Indigo50  = Color(0xFFE8E7FF)
val Indigo100 = Color(0xFFDAD7FF)
val Indigo200 = Color(0xFFC3C0FF)
val Indigo500 = Color(0xFF4F46E5)
val Indigo600 = Color(0xFF3525CD)
val Indigo900 = Color(0xFF1E1B4B)

val Amber50   = Color(0xFFFFFBEB)
val Amber100  = Color(0xFFFEF3C7)
val Amber400  = Color(0xFFFBBF24)
val Amber500  = Color(0xFFF59E0B)

val Emerald50  = Color(0xFFECFDF5)
val Emerald100 = Color(0xFFD1FAE5)
val Emerald500 = Color(0xFF10B981)
val Emerald600 = Color(0xFF059669)

// ── Surfaces ──────────────────────────────────────────────────────────────────
val Surface         = Color(0xFFFAF9F6)
val SurfaceLow      = Color(0xFFF4F3F1)
val SurfaceLowest   = Color(0xFFFFFFFF)
val SurfaceHigh     = Color(0xFFE9E8E5)
val SurfaceHighest  = Color(0xFFE3E2E0)
val SurfaceDim      = Color(0xFFDBDAD7)

// ── On-colors ─────────────────────────────────────────────────────────────────
val OnSurface         = Color(0xFF1A1C1A)
val OnSurfaceVariant  = Color(0xFF464555)
val OnPrimary         = Color(0xFFFFFFFF)

// ── Outline ───────────────────────────────────────────────────────────────────
val Outline        = Color(0xFF777587)
val OutlineVariant = Color(0xFFC7C4D8)

// ── Error ─────────────────────────────────────────────────────────────────────
val ErrorContainer   = Color(0xFFFFDAD6)
val OnErrorContainer = Color(0xFF93000A)

// ── Subject accents ───────────────────────────────────────────────────────────
val SubjectScienceBg     = Color(0xFFEEF2FF)
val SubjectMathBg        = Color(0xFFFFFBEB)
val SubjectEnglishBg     = Color(0xFFECFDF5)
val SubjectScienceBorder = Indigo500
val SubjectMathBorder    = Amber500
val SubjectEnglishBorder = Emerald500

// ── Status chips ──────────────────────────────────────────────────────────────
val ChipCompletedBg    = Emerald100
val ChipCompletedText  = Emerald600
val ChipInProgressBg   = Amber100
val ChipInProgressText = Color(0xFF92400E)
val ChipNotStartedBg   = SurfaceHigh
val ChipNotStartedText = OnSurfaceVariant

// ── Metric card pastels ───────────────────────────────────────────────────────
val MetricBlueBg   = Color(0xFFEEF2FF)
val MetricGreenBg  = Color(0xFFECFDF5)
val MetricAmberBg  = Amber50
val MetricPurpleBg = Color(0xFFF5F3FF)

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
val ShapeButton = RoundedCornerShape(50.dp)
val ShapeSheet  = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
