package com.hestami_ai.myhomeagent.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cottage
import androidx.compose.material.icons.filled.Handyman
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hestami_ai.myhomeagent.data.model.ServiceRequest
import com.hestami_ai.myhomeagent.data.model.ServiceRequestStatus
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import com.hestami_ai.myhomeagent.ui.viewmodel.DashboardViewModel
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Dashboard screen matching iOS DashboardView.swift.
 * Shows overview of properties, service requests, and quick actions.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DashboardScreen(
    modifier: Modifier = Modifier,
    onNavigateToAddProperty: () -> Unit = {},
    onNavigateToCreateRequest: () -> Unit = {},
    onNavigateToChat: () -> Unit = {},
    onNavigateToRequestDetail: (ServiceRequest) -> Unit = {},
    viewModel: DashboardViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(AppColors.PrimaryBackground)
    ) {
        TopAppBar(
            title = {
                Text(
                    text = "Dashboard",
                    color = AppColors.PrimaryText,
                    fontWeight = FontWeight.Bold
                )
            },
            colors = TopAppBarDefaults.topAppBarColors(
                containerColor = AppColors.PrimaryBackground
            )
        )

        PullToRefreshBox(
            isRefreshing = uiState.isLoading,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize()
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(horizontal = 16.dp)
                    .verticalScroll(rememberScrollState())
            ) {
                // Welcome section
                Text(
                    text = "Welcome back!",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.PrimaryText
                )

                Spacer(modifier = Modifier.height(8.dp))

                Text(
                    text = "Here's an overview of your home services",
                    fontSize = 14.sp,
                    color = AppColors.SecondaryText
                )

                Spacer(modifier = Modifier.height(24.dp))

                // Stats cards row
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    StatCard(
                        title = "Properties",
                        value = uiState.propertyCount.toString(),
                        icon = Icons.Filled.Cottage,
                        modifier = Modifier.weight(1f)
                    )
                    StatCard(
                        title = "Active Requests",
                        value = uiState.activeRequestCount.toString(),
                        icon = Icons.Filled.Handyman,
                        modifier = Modifier.weight(1f)
                    )
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Recent activity section
                Text(
                    text = "Recent Activity",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.PrimaryText
                )

                Spacer(modifier = Modifier.height(12.dp))

                if (uiState.recentRequests.isEmpty()) {
                    // Empty state
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        colors = CardDefaults.cardColors(
                            containerColor = AppColors.CardBackground
                        ),
                        shape = RoundedCornerShape(12.dp)
                    ) {
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.Inbox,
                                contentDescription = null,
                                tint = AppColors.SecondaryText,
                                modifier = Modifier.size(48.dp)
                            )
                            Spacer(modifier = Modifier.height(12.dp))
                            Text(
                                text = "No recent activity",
                                fontSize = 16.sp,
                                color = AppColors.SecondaryText
                            )
                            Text(
                                text = "Add a property to get started",
                                fontSize = 14.sp,
                                color = AppColors.DisabledText
                            )
                        }
                    }
                } else {
                    // Recent requests list
                    uiState.recentRequests.forEach { request ->
                        RecentActivityCard(
                            request = request,
                            onClick = { onNavigateToRequestDetail(request) }
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Quick actions section
                Text(
                    text = "Quick Actions",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.PrimaryText
                )

                Spacer(modifier = Modifier.height(12.dp))

                QuickActionCard(
                    title = "Add Property",
                    description = "Register a new property to manage",
                    onClick = onNavigateToAddProperty
                )

                Spacer(modifier = Modifier.height(8.dp))

                QuickActionCard(
                    title = "Create Service Request",
                    description = "Request maintenance or repairs",
                    onClick = onNavigateToCreateRequest
                )

                Spacer(modifier = Modifier.height(8.dp))

                QuickActionCard(
                    title = "AI Handyman",
                    description = "Get help with home maintenance questions",
                    onClick = onNavigateToChat
                )

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun RecentActivityCard(
    request: ServiceRequest,
    onClick: () -> Unit
) {
    val dateFormat = remember { SimpleDateFormat("MMM d", Locale.getDefault()) }
    
    Card(
        modifier = Modifier.fillMaxWidth(),
        onClick = onClick,
        colors = CardDefaults.cardColors(
            containerColor = AppColors.CardBackground
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            // Status indicator
            Box(
                modifier = Modifier
                    .size(8.dp)
                    .background(
                        when (request.status) {
                            ServiceRequestStatus.COMPLETED -> AppColors.SuccessColor
                            ServiceRequestStatus.IN_PROGRESS -> AppColors.InfoColor
                            ServiceRequestStatus.PENDING -> AppColors.WarningColor
                            else -> AppColors.SecondaryText
                        },
                        RoundedCornerShape(4.dp)
                    )
            )
            
            Spacer(modifier = Modifier.size(12.dp))
            
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = request.title?.ifEmpty { "Untitled Request" } ?: "Untitled Request",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Medium,
                    color = AppColors.PrimaryText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = request.status.name.replace("_", " "),
                    fontSize = 12.sp,
                    color = AppColors.SecondaryText
                )
            }
            
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Filled.Schedule,
                    contentDescription = null,
                    tint = AppColors.DisabledText,
                    modifier = Modifier.size(12.dp)
                )
                Spacer(modifier = Modifier.size(4.dp))
                Text(
                    text = dateFormat.format(request.createdAt),
                    fontSize = 12.sp,
                    color = AppColors.DisabledText
                )
            }
        }
    }
}

@Composable
private fun StatCard(
    title: String,
    value: String,
    icon: ImageVector,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(
            containerColor = AppColors.CardBackground
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = icon,
                    contentDescription = null,
                    tint = AppColors.SuccessColor,
                    modifier = Modifier.size(24.dp)
                )
            }
            Spacer(modifier = Modifier.height(12.dp))
            Text(
                text = value,
                fontSize = 32.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.PrimaryText
            )
            Text(
                text = title,
                fontSize = 14.sp,
                color = AppColors.SecondaryText
            )
        }
    }
}

@Composable
private fun QuickActionCard(
    title: String,
    description: String,
    onClick: () -> Unit
) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = AppColors.CardBackground
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(16.dp)
        ) {
            Text(
                text = title,
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = description,
                fontSize = 14.sp,
                color = AppColors.SecondaryText
            )
        }
    }
}
