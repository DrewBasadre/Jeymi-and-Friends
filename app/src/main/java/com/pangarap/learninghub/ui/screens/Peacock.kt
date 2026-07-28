package com.pangarap.learninghub.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.pangarap.learninghub.ui.theme.Amber500
import com.pangarap.learninghub.ui.theme.CreamChick
import com.pangarap.learninghub.ui.theme.GradientEnd
import com.pangarap.learninghub.ui.theme.Indigo500
import com.pangarap.learninghub.ui.theme.Indigo600
import com.pangarap.learninghub.ui.theme.Indigo900
import com.pangarap.learninghub.ui.theme.Ocean900
import com.pangarap.learninghub.ui.theme.TealBright

/**
 * Pavo the peacock — a 5-phase GROWTH mascot in crisp pixel art (flat-filled
 * rectangles on integer coordinates, no anti-aliasing gradients). The same
 * character matures from a small cream chick (phase 1) to a full iridescent
 * tail display (phase 5). Single source of mascot art for the Android app.
 */

private val GoldDeep = Color(0xFFB67D0C)

private data class Feather(val angle: Float, val length: Float)

private data class PhaseArt(
    val body: Color,
    val bodyShade: Color,
    val belly: Color,
    val crestDots: Int,
    val feathers: List<Feather>,
    val ocelli: Boolean,
    val cheeks: Boolean,
    val sparkle: Boolean,
)

private fun phaseArt(phase: Int): PhaseArt = when (phase.coerceIn(1, 5)) {
    1 -> PhaseArt(CreamChick, Color(0xFFE4D3A9), Color(0xFFFBF4E2), 1, emptyList(), false, true, false)
    2 -> PhaseArt(
        Color(0xFF8FB7AE), Color(0xFF6E9C93), Color(0xFFB5D6CE), 1,
        listOf(Feather(-16f, 9f), Feather(16f, 9f)), false, true, false,
    )
    3 -> PhaseArt(
        Indigo500, Indigo600, TealBright, 3,
        listOf(Feather(-30f, 14f), Feather(0f, 14f), Feather(30f, 14f)), true, false, false,
    )
    4 -> PhaseArt(
        Indigo500, Indigo600, TealBright, 3,
        listOf(Feather(-46f, 18f), Feather(-23f, 18f), Feather(0f, 18f), Feather(23f, 18f), Feather(46f, 18f)),
        true, true, false,
    )
    else -> PhaseArt(
        Indigo500, Indigo600, TealBright, 3,
        listOf(
            Feather(-72f, 22f), Feather(-48f, 22f), Feather(-24f, 22f), Feather(0f, 22f),
            Feather(24f, 22f), Feather(48f, 22f), Feather(72f, 22f),
        ),
        true, true, true,
    )
}

@Composable
fun PeacockPhase(phase: Int, size: Dp = 96.dp, modifier: Modifier = Modifier) {
    val art = phaseArt(phase)
    Canvas(modifier = modifier.size(size)) {
        val u = this.size.minDimension / 64f

        // Tail fan (behind body)
        for (f in art.feathers) {
            rotate(degrees = f.angle, pivot = Offset(32f * u, 44f * u)) {
                pixel(30.5f, 44f - f.length, 3f, f.length, TealBright, u)
                pixel(31.5f, 44f - f.length, 1f, f.length, Ocean900, u)
                if (art.ocelli) {
                    round(28f, 44f - f.length - 7f, 8f, 8f, Ocean900, u, 1f)
                    pixel(29.5f, 44f - f.length - 5.5f, 5f, 5f, Amber500, u)
                    pixel(31f, 44f - f.length - 4f, 2f, 2f, Indigo600, u)
                } else {
                    round(29.5f, 44f - f.length - 3f, 5f, 4f, Indigo500, u, 1f)
                }
            }
        }

        // Sparkles (final phase)
        if (art.sparkle) {
            pixel(12f, 16f, 2f, 2f, Amber500, u)
            pixel(50f, 14f, 2f, 2f, Amber500, u)
            pixel(8f, 30f, 2f, 2f, Amber500, u)
        }

        // Body
        round(24f, 34f, 16f, 20f, art.body, u, 3f)
        round(27f, 41f, 10f, 13f, art.belly, u, 3f)
        round(24f, 50f, 16f, 4f, art.bodyShade, u, 2f)
        pixel(27f, 54f, 3f, 2f, GoldDeep, u)
        pixel(34f, 54f, 3f, 2f, GoldDeep, u)

        // Head
        round(25f, 22f, 14f, 14f, art.body, u, 3f)

        // Crest
        if (art.crestDots >= 1) pixel(31.5f, 13f, 1f, 5f, art.bodyShade, u)
        if (art.crestDots >= 3) pixel(27f, 15f, 1f, 4f, art.bodyShade, u)
        if (art.crestDots >= 3) pixel(36f, 15f, 1f, 4f, art.bodyShade, u)
        if (art.crestDots >= 1) pixel(30f, 11f, 4f, 4f, Amber500, u)
        if (art.crestDots >= 3) pixel(25.5f, 13f, 3f, 3f, Amber500, u)
        if (art.crestDots >= 3) pixel(35.5f, 13f, 3f, 3f, Amber500, u)

        // Eyes (happy arcs)
        pixel(28f, 28f, 4f, 2f, Indigo900, u)
        pixel(29f, 27f, 2f, 1f, Indigo900, u)
        pixel(32f, 28f, 4f, 2f, Indigo900, u)
        pixel(33f, 27f, 2f, 1f, Indigo900, u)
        if (art.cheeks) {
            pixel(26f, 31f, 2f, 2f, Amber500.copy(alpha = 0.55f), u)
            pixel(36f, 31f, 2f, 2f, Amber500.copy(alpha = 0.55f), u)
        }

        // Beak + smile
        pixel(30f, 31f, 4f, 2f, Amber500, u)
        pixel(31f, 33f, 2f, 1f, GoldDeep, u)
        pixel(30f, 34f, 4f, 1f, art.bodyShade, u)
    }
}

private fun DrawScope.pixel(x: Float, y: Float, w: Float, h: Float, c: Color, u: Float) {
    drawRect(color = c, topLeft = Offset(x * u, y * u), size = Size(w * u, h * u))
}

private fun DrawScope.round(x: Float, y: Float, w: Float, h: Float, c: Color, u: Float, r: Float) {
    drawRoundRect(
        color = c,
        topLeft = Offset(x * u, y * u),
        size = Size(w * u, h * u),
        cornerRadius = CornerRadius(r * u, r * u),
    )
}

// ── Progress → phase mapping ────────────────────────────────────────────────

data class PeacockGrowth(val phase: Int, val name: String, val blurb: String)

private fun phaseMeta(phase: Int): PeacockGrowth = when (phase) {
    1 -> PeacockGrowth(1, "Hatchling", "Freshly hatched! Finish a lesson to help Pavo grow.")
    2 -> PeacockGrowth(2, "Fledgling", "Finding its feathers — keep the momentum going.")
    3 -> PeacockGrowth(3, "Plumed", "Colors are coming in. You’re on a roll!")
    4 -> PeacockGrowth(4, "Brilliant", "Almost in full bloom — so close now.")
    else -> PeacockGrowth(5, "Radiant", "Full iridescent display. Outstanding work!")
}

private fun phaseFromGrowth(growth: Float): Int =
    (1 + (growth.coerceIn(0f, 0.999f) * 5f).toInt()).coerceIn(1, 5)

/** Phase from real progress: completion (weighted) blended with mastery. */
fun peacockPhase(completedModules: Int, totalModules: Int, averageScore: Int): PeacockGrowth {
    val completion = if (totalModules > 0) completedModules.toFloat() / totalModules else (completedModules / 6f).coerceAtMost(1f)
    val mastery = (averageScore / 100f).coerceIn(0f, 1f)
    return phaseMeta(phaseFromGrowth(completion * 0.6f + mastery * 0.4f))
}

/** Phase from a single 0–100 score (for compact places like leaderboard rows). */
fun peacockPhaseFromScore(score: Int): PeacockGrowth =
    phaseMeta(phaseFromGrowth(score.coerceIn(0, 100) / 100f))
