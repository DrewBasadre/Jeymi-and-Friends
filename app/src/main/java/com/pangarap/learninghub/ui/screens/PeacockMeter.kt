package com.pangarap.learninghub.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.pangarap.learninghub.ui.theme.Amber500
import com.pangarap.learninghub.ui.theme.GradientEnd
import com.pangarap.learninghub.ui.theme.Indigo500
import com.pangarap.learninghub.ui.theme.SpacingLg
import com.pangarap.learninghub.ui.theme.SpacingMd
import com.pangarap.learninghub.ui.theme.SpacingSm
import com.pangarap.learninghub.ui.theme.TealBright

/**
 * The learner's growth peacock hero: shows the current phase, an encouraging
 * blurb, a 5-pip growth indicator, and the overall-performance bar.
 */
@Composable
fun PeacockMeter(
    completedModules: Int,
    totalModules: Int,
    averageScore: Int,
    modifier: Modifier = Modifier,
) {
    val growth = peacockPhase(completedModules, totalModules, averageScore)
    val fraction = (averageScore / 100f).coerceIn(0f, 1f)
    val white = Color.White

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = Indigo500),
    ) {
        Column(
            Modifier.padding(SpacingLg),
            verticalArrangement = Arrangement.spacedBy(SpacingMd),
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(SpacingMd),
            ) {
                Box(
                    modifier = Modifier
                        .size(116.dp)
                        .clip(RoundedCornerShape(16.dp))
                        .background(white.copy(alpha = 0.12f)),
                    contentAlignment = Alignment.Center,
                ) {
                    PeacockPhase(phase = growth.phase, size = 104.dp)
                }
                Column(Modifier.weight(1f)) {
                    Text(
                        "Your Peacock · Phase ${growth.phase} of 5",
                        color = TealBright,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        growth.name,
                        color = white,
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        growth.blurb,
                        color = white.copy(alpha = 0.9f),
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Spacer(Modifier.height(SpacingSm))
                    Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                        for (i in 1..5) {
                            Box(
                                modifier = Modifier
                                    .width(20.dp)
                                    .height(6.dp)
                                    .clip(RoundedCornerShape(3.dp))
                                    .background(if (i <= growth.phase) Amber500 else white.copy(alpha = 0.22f)),
                            )
                        }
                    }
                }
            }
            Column(
                modifier = Modifier
                    .clip(RoundedCornerShape(12.dp))
                    .background(white.copy(alpha = 0.14f))
                    .padding(SpacingMd),
                verticalArrangement = Arrangement.spacedBy(SpacingSm),
            ) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(12.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(white.copy(alpha = 0.25f)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(fraction)
                            .height(12.dp)
                            .clip(RoundedCornerShape(6.dp))
                            .background(Brush.horizontalGradient(listOf(TealBright, GradientEnd))),
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        "Overall performance",
                        color = white.copy(alpha = 0.9f),
                        style = MaterialTheme.typography.labelSmall,
                    )
                    Text("$averageScore%", color = white, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
}
