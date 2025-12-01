package com.hestami_ai.myhomeagent.ui.theme

import androidx.compose.ui.graphics.Color

/**
 * App color palette matching iOS AppTheme.swift
 */
object AppColors {
    // Background Colors - Blue-toned from web app
    val PrimaryBackground = Color(0xFF141D2B)      // RGB(20, 29, 43)
    val SecondaryBackground = Color(0xFF1A2330)    // RGB(26, 35, 48)
    val TertiaryBackground = Color(0xFF19222F)     // RGB(25, 34, 47)
    val CardBackground = Color(0xFF161F2D)         // RGB(22, 31, 45)

    // Navigation and Sidebar Colors - Green-toned from web app
    val NavigationBackground = Color(0xFF16333C)   // RGB(22, 51, 60)
    val SidebarBackground = Color(0xFF15323B)      // RGB(21, 50, 59)

    // Text Colors
    val PrimaryText = Color(0xFFFFFFFF)            // White
    val SecondaryText = Color(0xFFB3B3B3)          // Light gray
    val DisabledText = Color(0xFF808080)           // Gray

    // Accent Colors
    val AccentColor = Color(0xFF16333C)            // Primary accent (green-blue)
    val AccentSecondary = Color(0xFFF24F4F)        // Red accent
    val AccentPrimary = Color(0xFF0078F2)          // Blue accent

    // Status Colors
    val SuccessColor = Color(0xFF29B578)           // Success green
    val WarningColor = Color(0xFFF2B027)           // Warning yellow
    val ErrorColor = Color(0xFFF24F4F)             // Error red
    val InfoColor = Color(0xFF0078F2)              // Info blue

    // UI Elements
    val ButtonBackground = Color(0xFF16333C)       // Navigation green-blue
    val ButtonText = Color(0xFFFFFFFF)             // White
    val BorderColor = Color(0xFF111A28)            // RGB(17, 26, 40)
    val InputBackground = Color(0xCC111C29)        // With opacity

    // Tab Bar
    val TabBarBackground = Color(0xFF16333C)       // Green navigation color
    val NavBarBackground = Color(0xFF15323B)       // Alternative navigation
}

// Legacy color values for Material theme compatibility
val Purple80 = Color(0xFFD0BCFF)
val PurpleGrey80 = Color(0xFFCCC2DC)
val Pink80 = Color(0xFFEFB8C8)

val Purple40 = Color(0xFF6650a4)
val PurpleGrey40 = Color(0xFF625b71)
val Pink40 = Color(0xFF7D5260)