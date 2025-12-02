package com.hestami_ai.myhomeagent.ui.screens.more

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.filled.Feedback
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hestami_ai.myhomeagent.ui.theme.AppColors

/**
 * More screen matching iOS MoreView.swift.
 * Shows additional options like settings, profile, help, and logout.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreScreen(
    modifier: Modifier = Modifier,
    onLogout: () -> Unit,
    onNavigateToChat: () -> Unit = {}
) {
    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.PrimaryBackground)
    ) {
        TopAppBar(
            title = {
                Text(
                    text = "More",
                    color = AppColors.PrimaryText,
                    fontWeight = FontWeight.Bold
                )
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = AppColors.PrimaryBackground
            )
        )

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            // Account section
            SectionHeader(title = "Account")

            MenuCard {
                MenuItem(
                    icon = Icons.Outlined.Person,
                    title = "Profile",
                    onClick = { /* TODO */ }
                )
                MenuDivider()
                MenuItem(
                    icon = Icons.Outlined.Settings,
                    title = "Settings",
                    onClick = { /* TODO */ }
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Features section
            SectionHeader(title = "Features")

            MenuCard {
                MenuItem(
                    icon = Icons.Filled.SmartToy,
                    title = "AI Assistant",
                    onClick = onNavigateToChat
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Support section
            SectionHeader(title = "Support")

            MenuCard {
                MenuItem(
                    icon = Icons.AutoMirrored.Filled.HelpOutline,
                    title = "Help & FAQ",
                    onClick = { /* TODO */ }
                )
                MenuDivider()
                MenuItem(
                    icon = Icons.Filled.Feedback,
                    title = "Send Feedback",
                    onClick = { /* TODO */ }
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Logout
            MenuCard {
                MenuItem(
                    icon = Icons.AutoMirrored.Filled.Logout,
                    title = "Log Out",
                    titleColor = AppColors.ErrorColor,
                    onClick = onLogout
                )
            }

            Spacer(modifier = Modifier.height(32.dp))

            // Version info
            Text(
                text = "My Home Agent v1.0",
                fontSize = 12.sp,
                color = AppColors.DisabledText,
                modifier = Modifier.align(Alignment.CenterHorizontally)
            )

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title.uppercase(),
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color = AppColors.SecondaryText,
        modifier = Modifier.padding(start = 4.dp, bottom = 8.dp)
    )
}

@Composable
private fun MenuCard(
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = AppColors.CardBackground
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column {
            content()
        }
    }
}

@Composable
private fun MenuItem(
    icon: ImageVector,
    title: String,
    titleColor: androidx.compose.ui.graphics.Color = AppColors.PrimaryText,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = titleColor,
            modifier = Modifier.size(24.dp)
        )
        Spacer(modifier = Modifier.width(16.dp))
        Text(
            text = title,
            fontSize = 16.sp,
            color = titleColor
        )
    }
}

@Composable
private fun MenuDivider() {
    HorizontalDivider(
        modifier = Modifier.padding(start = 56.dp),
        color = AppColors.BorderColor
    )
}
