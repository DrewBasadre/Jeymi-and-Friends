package com.pangarap.learninghub.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.ui.graphics.Color
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.unit.dp

// ── Scholar Indigo — Material 3 colour scheme ─────────────────────────────────
private val ScholarIndigoLight = lightColorScheme(
    primary            = Indigo500,
    onPrimary          = OnPrimary,
    primaryContainer   = Indigo100,
    onPrimaryContainer = Indigo900,

    secondary            = Amber500,
    onSecondary          = OnPrimary,
    secondaryContainer   = Amber100,
    onSecondaryContainer = Color(0xFF92400E),

    tertiary            = Emerald500,
    onTertiary          = OnPrimary,
    tertiaryContainer   = Emerald100,
    onTertiaryContainer = Emerald600,

    background    = Surface,
    onBackground  = OnSurface,

    surface              = Surface,
    onSurface            = OnSurface,
    surfaceVariant       = SurfaceHigh,
    onSurfaceVariant     = OnSurfaceVariant,
    surfaceContainerLow  = SurfaceLow,
    surfaceContainer     = SurfaceHigh,
    surfaceContainerHigh = SurfaceHighest,

    outline        = Outline,
    outlineVariant = OutlineVariant,

    error            = ErrorContainer,
    onError          = OnPrimary,
    errorContainer   = ErrorContainer,
    onErrorContainer = OnErrorContainer
)

// ── Shapes — 16dp large cards, 12dp inputs, 50% pill ─────────────────────────
private val AppShapes = Shapes(
    extraSmall = androidx.compose.foundation.shape.RoundedCornerShape(4.dp),
    small      = androidx.compose.foundation.shape.RoundedCornerShape(8.dp),
    medium     = androidx.compose.foundation.shape.RoundedCornerShape(12.dp),
    large      = androidx.compose.foundation.shape.RoundedCornerShape(16.dp),
    extraLarge = androidx.compose.foundation.shape.RoundedCornerShape(24.dp)
)

@Composable
fun LearningHubTheme(content: @Composable () -> Unit) {
    @Suppress("UNUSED_VARIABLE")
    val dark = isSystemInDarkTheme()
    MaterialTheme(
        colorScheme = ScholarIndigoLight,
        typography  = AppTypography,
        shapes      = AppShapes,
        content     = content
    )
}
