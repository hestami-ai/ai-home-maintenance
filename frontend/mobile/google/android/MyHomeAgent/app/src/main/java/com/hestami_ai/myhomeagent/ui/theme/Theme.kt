package com.hestami_ai.myhomeagent.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

/**
 * Custom dark color scheme matching iOS AppTheme colors.
 * The app uses a dark theme exclusively to match the web app design.
 */
private val AppColorScheme = darkColorScheme(
    primary = AppColors.AccentPrimary,
    onPrimary = AppColors.PrimaryText,
    primaryContainer = AppColors.NavigationBackground,
    onPrimaryContainer = AppColors.PrimaryText,
    
    secondary = AppColors.SuccessColor,
    onSecondary = AppColors.PrimaryText,
    secondaryContainer = AppColors.CardBackground,
    onSecondaryContainer = AppColors.PrimaryText,
    
    tertiary = AppColors.AccentSecondary,
    onTertiary = AppColors.PrimaryText,
    
    background = AppColors.PrimaryBackground,
    onBackground = AppColors.PrimaryText,
    
    surface = AppColors.SecondaryBackground,
    onSurface = AppColors.PrimaryText,
    
    surfaceVariant = AppColors.CardBackground,
    onSurfaceVariant = AppColors.SecondaryText,
    
    error = AppColors.ErrorColor,
    onError = AppColors.PrimaryText,
    
    outline = AppColors.BorderColor,
    outlineVariant = AppColors.BorderColor
)

@Composable
fun MyHomeAgentTheme(
    darkTheme: Boolean = true, // Always use dark theme
    content: @Composable () -> Unit
) {
    val colorScheme = AppColorScheme
    
    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            WindowCompat.getInsetsController(window, view).apply {
                isAppearanceLightStatusBars = false
                isAppearanceLightNavigationBars = false
            }
            // Use WindowCompat for edge-to-edge display
            WindowCompat.setDecorFitsSystemWindows(window, false)
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}