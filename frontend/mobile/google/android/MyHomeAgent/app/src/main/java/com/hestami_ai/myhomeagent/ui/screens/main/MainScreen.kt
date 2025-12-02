package com.hestami_ai.myhomeagent.ui.screens.main

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cottage
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.HomeRepairService
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.SmartToy
import androidx.compose.material.icons.outlined.Cottage
import androidx.compose.material.icons.outlined.Dashboard
import androidx.compose.material.icons.outlined.HomeRepairService
import androidx.compose.material.icons.outlined.SmartToy
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.ui.Alignment
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.graphics.vector.ImageVector
import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.data.model.ServiceRequest
import com.hestami_ai.myhomeagent.ui.components.AppDrawer
import com.hestami_ai.myhomeagent.ui.screens.chat.EmbeddedChatScreen
import com.hestami_ai.myhomeagent.ui.screens.dashboard.DashboardScreen
import com.hestami_ai.myhomeagent.ui.screens.properties.PropertiesScreen
import com.hestami_ai.myhomeagent.ui.screens.requests.RequestsScreen
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import kotlinx.coroutines.launch

/**
 * Bottom navigation item data.
 */
data class BottomNavItem(
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector
)

/**
 * Main screen with bottom navigation and side drawer menu.
 * - Bottom nav: Dashboard, Properties, Requests, AI Assistant
 * - Side drawer: Profile, Settings, Help, Feedback, Logout
 */
@Composable
fun MainScreen(
    onLogout: () -> Unit,
    onNavigateToAddProperty: () -> Unit = {},
    onNavigateToCreateRequest: () -> Unit = {},
    onNavigateToChat: (String?) -> Unit = {},
    onNavigateToPropertyDetail: (Property) -> Unit = {},
    onNavigateToRequestDetail: (ServiceRequest) -> Unit = {},
    onNavigateToProfile: () -> Unit = {},
    onNavigateToSettings: () -> Unit = {}
) {
    val drawerState = rememberDrawerState(initialValue = DrawerValue.Closed)
    val scope = rememberCoroutineScope()
    
    val navItems = listOf(
        BottomNavItem(
            title = "Dashboard",
            selectedIcon = Icons.Filled.Dashboard,
            unselectedIcon = Icons.Outlined.Dashboard
        ),
        BottomNavItem(
            title = "Properties",
            selectedIcon = Icons.Filled.Cottage,
            unselectedIcon = Icons.Outlined.Cottage
        ),
        BottomNavItem(
            title = "Requests",
            selectedIcon = Icons.Filled.HomeRepairService,
            unselectedIcon = Icons.Outlined.HomeRepairService
        ),
        BottomNavItem(
            title = "AI Assistant",
            selectedIcon = Icons.Filled.SmartToy,
            unselectedIcon = Icons.Outlined.SmartToy
        )
    )

    var selectedIndex by rememberSaveable { mutableIntStateOf(0) }

    // Use RTL layout direction to make drawer open from right
    CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Rtl) {
        ModalNavigationDrawer(
            drawerState = drawerState,
            drawerContent = {
                // Reset to LTR for drawer content
                CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                    AppDrawer(
                        onCloseDrawer = {
                            scope.launch { drawerState.close() }
                        },
                        onNavigateToProfile = onNavigateToProfile,
                        onNavigateToSettings = onNavigateToSettings,
                        onLogout = onLogout
                    )
                }
            },
            gesturesEnabled = drawerState.isOpen
        ) {
            // Reset to LTR for main content
            CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
                Scaffold(
                    bottomBar = {
                        NavigationBar(
                            containerColor = AppColors.NavigationBackground,
                            contentColor = AppColors.PrimaryText
                        ) {
                            navItems.forEachIndexed { index, item ->
                                NavigationBarItem(
                                    selected = selectedIndex == index,
                                    onClick = { selectedIndex = index },
                                    icon = {
                                        Icon(
                                            imageVector = if (selectedIndex == index) item.selectedIcon else item.unselectedIcon,
                                            contentDescription = item.title
                                        )
                                    },
                                    label = { Text(item.title) },
                                    colors = NavigationBarItemDefaults.colors(
                                        selectedIconColor = AppColors.SuccessColor,
                                        selectedTextColor = AppColors.SuccessColor,
                                        unselectedIconColor = AppColors.SecondaryText,
                                        unselectedTextColor = AppColors.SecondaryText,
                                        indicatorColor = AppColors.NavigationBackground
                                    )
                                )
                            }
                        }
                    }
                ) { innerPadding ->
                    Box(modifier = Modifier.fillMaxSize()) {
                        // Content based on selected tab
                        when (selectedIndex) {
                            0 -> DashboardScreen(
                                modifier = Modifier.padding(innerPadding),
                                onNavigateToAddProperty = onNavigateToAddProperty,
                                onNavigateToCreateRequest = onNavigateToCreateRequest,
                                onNavigateToChat = { onNavigateToChat(null) },
                                onNavigateToRequestDetail = onNavigateToRequestDetail
                            )
                            1 -> PropertiesScreen(
                                modifier = Modifier.padding(innerPadding),
                                onAddPropertyClick = onNavigateToAddProperty,
                                onPropertyClick = onNavigateToPropertyDetail
                            )
                            2 -> RequestsScreen(
                                modifier = Modifier.padding(innerPadding),
                                onCreateRequestClick = onNavigateToCreateRequest,
                                onRequestClick = onNavigateToRequestDetail
                            )
                            3 -> EmbeddedChatScreen(
                                modifier = Modifier.padding(innerPadding)
                            )
                        }
                        
                        // Menu button in top-right corner
                        IconButton(
                            onClick = { scope.launch { drawerState.open() } },
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .statusBarsPadding()
                                .padding(top = 4.dp, end = 4.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Menu,
                                contentDescription = "Menu",
                                tint = AppColors.SecondaryText
                            )
                        }
                    }
                }
            }
        }
    }
}
