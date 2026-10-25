package com.example.gicahr.theme

import androidx.compose.ui.graphics.Color

import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable

val GicaTeal = Color(0xFF0D9488)
val GicaTealDark = Color(0xFF0F766E)
val GicaIndigo = Color(0xFF4F46E5)

val BackgroundLight = Color(0xFFF1F5F9)
val CardBackground = Color(0xFFFFFFFF)

val TextPrimary: Color
    @Composable
    get() = MaterialTheme.colorScheme.onBackground

val TextSecondary: Color
    @Composable
    get() = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.7f)

val TextMuted: Color
    @Composable
    get() = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.5f)

val SuccessGreen = Color(0xFF10B981)
val WarningAmber = Color(0xFFF59E0B)
val DangerRed = Color(0xFFEF4444)
val InfoBlue = Color(0xFF0284C7)
