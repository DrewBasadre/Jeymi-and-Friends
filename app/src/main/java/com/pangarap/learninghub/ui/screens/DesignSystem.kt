package com.pangarap.learninghub.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.pangarap.learninghub.ui.theme.*

// ─────────────────────────────────────────────────────────────────────────────
//  SCHOLAR INDIGO — Shared Design Atoms
//  All tokens (spacing, shapes, colors) live in ui/theme/Color.kt and are
//  imported here via the wildcard import above.
// ─────────────────────────────────────────────────────────────────────────────

// ── STATUS CHIP ───────────────────────────────────────────────────────────────
@Composable
fun StatusChip(status: String, modifier: Modifier = Modifier) {
    val (bg, fg, label) = when (status.uppercase()) {
        "COMPLETED"   -> Triple(ChipCompletedBg,  ChipCompletedText,  "✓ Completed")
        "IN_PROGRESS" -> Triple(ChipInProgressBg, ChipInProgressText, "● In Progress")
        else          -> Triple(ChipNotStartedBg, ChipNotStartedText, "Not Started")
    }
    Box(
        modifier = modifier
            .clip(ShapeChip)
            .background(bg)
            .padding(horizontal = SpacingMd, vertical = SpacingXs)
    ) {
        Text(
            text = label,
            color = fg,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.SemiBold
        )
    }
}

// ── SUBJECT ACCENT HELPERS ────────────────────────────────────────────────────
fun subjectAccentColor(subjectName: String): Color = when (subjectName.uppercase()) {
    "MATH"    -> Amber500
    "ENGLISH" -> Emerald500
    "ADDED_MATERIALS" -> Color(0xFF0F766E)
    else      -> Indigo500
}

fun subjectCardBg(subjectName: String): Color = when (subjectName.uppercase()) {
    "MATH"    -> SubjectMathBg
    "ENGLISH" -> SubjectEnglishBg
    "ADDED_MATERIALS" -> Color(0xFFE6FFFB)
    else      -> SubjectScienceBg
}

// ── METRIC CARD ───────────────────────────────────────────────────────────────
enum class MetricTint { Blue, Green, Amber, Purple }

private fun metricBg(tint: MetricTint) = when (tint) {
    MetricTint.Blue   -> MetricBlueBg
    MetricTint.Green  -> MetricGreenBg
    MetricTint.Amber  -> MetricAmberBg
    MetricTint.Purple -> MetricPurpleBg
}

@Composable
fun HubMetricCard(
    label: String,
    value: String,
    tint: MetricTint = MetricTint.Blue,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        shape = ShapeCard,
        colors = CardDefaults.cardColors(containerColor = metricBg(tint))
    ) {
        Column(Modifier.padding(SpacingLg), verticalArrangement = Arrangement.spacedBy(SpacingXs)) {
            Text(label, style = MaterialTheme.typography.labelMedium, color = OnSurfaceVariant)
            Text(value, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold, color = OnSurface)
        }
    }
}

// ── PRIMARY BUTTON ────────────────────────────────────────────────────────────
@Composable
fun HubPrimaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = ShapeButton,
        colors = ButtonDefaults.buttonColors(
            containerColor = Indigo500,
            contentColor = Color.White,
            disabledContainerColor = SurfaceHigh,
            disabledContentColor = OnSurfaceVariant
        ),
        modifier = modifier.heightIn(min = 48.dp)
    ) {
        Text(text, fontWeight = FontWeight.SemiBold, fontSize = 15.sp)
    }
}

// ── SECONDARY BUTTON ──────────────────────────────────────────────────────────
@Composable
fun HubSecondaryButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = ShapeButton,
        colors = ButtonDefaults.outlinedButtonColors(
            contentColor = Indigo500,
            disabledContentColor = OnSurfaceVariant
        ),
        border = androidx.compose.foundation.BorderStroke(1.5.dp, if (enabled) Indigo500 else OutlineVariant),
        modifier = modifier.heightIn(min = 48.dp)
    ) {
        Text(text, fontWeight = FontWeight.Medium, fontSize = 15.sp)
    }
}

// ── SECTION TITLE ─────────────────────────────────────────────────────────────
@Composable
fun HubSectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        color = Indigo900,
        modifier = modifier.padding(top = SpacingMd, bottom = SpacingSm)
    )
}

// ── INITIAL AVATAR ────────────────────────────────────────────────────────────
@Composable
fun InitialAvatar(initial: String, size: Dp = 64.dp) {
    Box(
        modifier = Modifier
            .size(size)
            .background(
                brush = Brush.linearGradient(listOf(Indigo500, Indigo600)),
                shape = CircleShape
            ),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = initial.take(1).uppercase(),
            color = Color.White,
            fontWeight = FontWeight.Bold,
            fontSize = (size.value * 0.4f).sp
        )
    }
}

// ── OFFLINE BADGE ─────────────────────────────────────────────────────────────
@Composable
fun OfflineBadge(modifier: Modifier = Modifier) {
    Row(
        modifier = modifier
            .clip(ShapeChip)
            .background(Amber50)
            .border(1.dp, Amber400, ShapeChip)
            .padding(horizontal = SpacingMd, vertical = SpacingXs),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(SpacingXs)
    ) {
        Text("●", color = Amber500, fontSize = 8.sp)
        Text("All data saved locally", style = MaterialTheme.typography.labelSmall, color = Color(0xFF92400E))
    }
}

// ── APP BRAND HEADER ──────────────────────────────────────────────────────────
@Composable
fun AppBrandHeader(modifier: Modifier = Modifier) {
    Column(modifier = modifier, horizontalAlignment = Alignment.CenterHorizontally) {
        androidx.compose.foundation.Image(
            painter = androidx.compose.ui.res.painterResource(id = com.pangarap.learninghub.R.mipmap.ic_launcher),
            contentDescription = "WAIS Logo",
            modifier = Modifier
                .size(80.dp)
                .clip(RoundedCornerShape(20.dp))
        )
        Spacer(Modifier.height(SpacingMd))
        Text("WAIS", style = MaterialTheme.typography.headlineLarge, fontWeight = FontWeight.Bold, color = Indigo900)
        Text("Offline-First Grade 5 Learning", style = MaterialTheme.typography.bodyMedium, color = OnSurfaceVariant)
    }
}

// ── PROFILE INFO ROW ──────────────────────────────────────────────────────────
@Composable
fun ProfileInfoRow(label: String, value: String, modifier: Modifier = Modifier) {
    Row(
        modifier = modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label, color = OnSurfaceVariant, modifier = Modifier.weight(1f))
        Text(value, fontWeight = FontWeight.Bold, modifier = Modifier.weight(1.4f))
    }
}

// ── ATTEMPT ROW ───────────────────────────────────────────────────────────────
@Composable
fun HubAttemptRow(
    attemptNumber: Int,
    score: Int,
    totalItems: Int,
    moduleId: String,
    formattedDuration: String,
    masteryLevel: String,
    weakTopic: String,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = ShapeCard,
        colors = CardDefaults.cardColors(containerColor = SurfaceLow)
    ) {
        Column(
            Modifier.padding(SpacingMd),
            verticalArrangement = Arrangement.spacedBy(SpacingXs)
        ) {
            Text(
                "Attempt $attemptNumber: $score/$totalItems",
                fontWeight = FontWeight.Bold,
                color = OnSurface
            )
            Text("Module: $moduleId", color = OnSurfaceVariant)
            Text("Time: $formattedDuration - Mastery: $masteryLevel", color = OnSurfaceVariant)
            Text("Weak: $weakTopic", color = OnSurfaceVariant)
        }
    }
}

// ── ANALYSIS CARD (mint background) ───────────────────────────────────────────
@Composable
fun HubAnalysisCard(text: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = ShapeCard,
        colors = CardDefaults.cardColors(containerColor = Color(0xFFF0FDFA))
    ) {
        Text(
            text,
            modifier = Modifier.padding(SpacingLg),
            color = OnSurface,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

// ── ASSESSMENT CARD (light blue background) ───────────────────────────────────
@Composable
fun HubAssessmentCard(text: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = ShapeCard,
        colors = CardDefaults.cardColors(containerColor = Color(0xFFEFF6FF))
    ) {
        Text(
            text,
            modifier = Modifier.padding(SpacingLg),
            color = OnSurface,
            style = MaterialTheme.typography.bodyMedium
        )
    }
}

// ── SUBJECT NAVIGATION CARD ──────────────────────────────────────────────────
@Composable
fun SubjectNavigationCard(
    subject: String,
    icon: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = ShapeCard,
        colors = CardDefaults.cardColors(containerColor = subjectCardBg(subject)),
        onClick = onClick
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(SpacingLg),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(SpacingMd),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(icon, fontSize = 24.sp)
                Text(
                    subject,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = subjectAccentColor(subject)
                )
            }
            Text("›", fontSize = 24.sp, color = OnSurfaceVariant)
        }
    }
}
