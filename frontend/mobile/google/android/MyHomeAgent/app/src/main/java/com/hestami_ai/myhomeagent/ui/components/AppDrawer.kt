package com.hestami_ai.myhomeagent.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.HelpOutline
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Feedback
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hestami_ai.myhomeagent.ui.theme.AppColors

/**
 * App drawer (side menu) component.
 * Contains menu items previously in the "More" tab.
 */
@Composable
fun AppDrawer(
    onCloseDrawer: () -> Unit,
    onNavigateToProfile: () -> Unit = {},
    onNavigateToSettings: () -> Unit = {},
    onNavigateToHelp: () -> Unit = {},
    onNavigateToFeedback: () -> Unit = {},
    onLogout: () -> Unit
) {
    ModalDrawerSheet(
        drawerContainerColor = AppColors.PrimaryBackground,
        modifier = Modifier.width(300.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxHeight()
                .verticalScroll(rememberScrollState())
        ) {
            // Header
            DrawerHeader(onCloseDrawer = onCloseDrawer)
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Account section
            DrawerSectionHeader(title = "Account")
            
            DrawerMenuItem(
                icon = Icons.Outlined.Person,
                title = "Profile",
                onClick = {
                    onNavigateToProfile()
                    onCloseDrawer()
                }
            )
            
            DrawerMenuItem(
                icon = Icons.Outlined.Settings,
                title = "Settings",
                onClick = {
                    onNavigateToSettings()
                    onCloseDrawer()
                }
            )
            
            Spacer(modifier = Modifier.height(16.dp))
            HorizontalDivider(color = AppColors.BorderColor)
            Spacer(modifier = Modifier.height(16.dp))
            
            // Support section
            DrawerSectionHeader(title = "Support")
            
            DrawerMenuItem(
                icon = Icons.AutoMirrored.Filled.HelpOutline,
                title = "Help & FAQ",
                onClick = {
                    onNavigateToHelp()
                    onCloseDrawer()
                }
            )
            
            DrawerMenuItem(
                icon = Icons.Filled.Feedback,
                title = "Send Feedback",
                onClick = {
                    onNavigateToFeedback()
                    onCloseDrawer()
                }
            )
            
            Spacer(modifier = Modifier.weight(1f))
            
            HorizontalDivider(color = AppColors.BorderColor)
            
            // Logout
            DrawerMenuItem(
                icon = Icons.AutoMirrored.Filled.Logout,
                title = "Log Out",
                titleColor = AppColors.ErrorColor,
                onClick = {
                    onLogout()
                    onCloseDrawer()
                }
            )
            
            // Version info
            Text(
                text = "My Home Agent v1.0",
                fontSize = 12.sp,
                color = AppColors.DisabledText,
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .padding(vertical = 16.dp)
            )
        }
    }
}

@Composable
private fun DrawerHeader(onCloseDrawer: () -> Unit) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.CardBackground)
            .padding(16.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // App icon placeholder
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .clip(CircleShape)
                    .background(AppColors.SuccessColor),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = Icons.Filled.Home,
                    contentDescription = null,
                    tint = AppColors.PrimaryText,
                    modifier = Modifier.size(28.dp)
                )
            }
            
            Spacer(modifier = Modifier.width(12.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = "My Home Agent",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.PrimaryText
                )
                Text(
                    text = "Home Maintenance Assistant",
                    fontSize = 12.sp,
                    color = AppColors.SecondaryText
                )
            }
            
            IconButton(onClick = onCloseDrawer) {
                Icon(
                    imageVector = Icons.Filled.Close,
                    contentDescription = "Close menu",
                    tint = AppColors.SecondaryText
                )
            }
        }
    }
}

@Composable
private fun DrawerSectionHeader(title: String) {
    Text(
        text = title.uppercase(),
        fontSize = 12.sp,
        fontWeight = FontWeight.SemiBold,
        color = AppColors.SecondaryText,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp)
    )
}

@Composable
private fun DrawerMenuItem(
    icon: ImageVector,
    title: String,
    titleColor: androidx.compose.ui.graphics.Color = AppColors.PrimaryText,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(titleColor.copy(alpha = 0.1f)),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = titleColor,
                modifier = Modifier.size(22.dp)
            )
        }
        Spacer(modifier = Modifier.width(16.dp))
        Text(
            text = title,
            fontSize = 16.sp,
            color = titleColor,
            fontWeight = FontWeight.Medium
        )
    }
}
