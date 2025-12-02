package com.hestami_ai.myhomeagent.ui.screens.requests

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.outlined.HomeRepairService
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FilterChipDefaults
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hestami_ai.myhomeagent.data.model.ServiceRequest
import com.hestami_ai.myhomeagent.data.model.ServiceRequestPriority
import com.hestami_ai.myhomeagent.data.model.ServiceRequestStatus
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import com.hestami_ai.myhomeagent.ui.viewmodel.RequestFilter
import com.hestami_ai.myhomeagent.ui.viewmodel.RequestsViewModel
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Service requests screen matching iOS RequestsView.swift.
 * Lists all service requests with ability to create new ones.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun RequestsScreen(
    modifier: Modifier = Modifier,
    onRequestClick: ((ServiceRequest) -> Unit)? = null,
    onCreateRequestClick: () -> Unit = {},
    viewModel: RequestsViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Show error in snackbar
    LaunchedEffect(uiState.error) {
        uiState.error?.let { error ->
            snackbarHostState.showSnackbar(error)
            viewModel.clearError()
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Service Requests",
                        color = AppColors.PrimaryText,
                        fontWeight = FontWeight.Bold
                    )
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AppColors.PrimaryBackground
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onCreateRequestClick,
                containerColor = AppColors.SuccessColor,
                contentColor = AppColors.PrimaryText
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Create Request"
                )
            }
        },
        snackbarHost = {
            SnackbarHost(hostState = snackbarHostState) { data ->
                Snackbar(
                    snackbarData = data,
                    containerColor = AppColors.ErrorColor,
                    contentColor = AppColors.PrimaryText
                )
            }
        },
        containerColor = AppColors.PrimaryBackground
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Filter chips
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                RequestFilter.entries.forEach { filter ->
                    FilterChip(
                        selected = uiState.selectedFilter == filter,
                        onClick = { viewModel.applyFilter(filter) },
                        label = { Text(filter.displayName) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = AppColors.SuccessColor,
                            selectedLabelColor = AppColors.PrimaryText,
                            containerColor = AppColors.CardBackground,
                            labelColor = AppColors.SecondaryText
                        )
                    )
                }
            }

            PullToRefreshBox(
                isRefreshing = uiState.isRefreshing,
                onRefresh = { viewModel.refreshRequests() },
                modifier = Modifier.fillMaxSize()
            ) {
                when {
                    uiState.isLoading && uiState.requests.isEmpty() -> {
                        Box(
                            modifier = Modifier.fillMaxSize(),
                            contentAlignment = Alignment.Center
                        ) {
                            CircularProgressIndicator(color = AppColors.SuccessColor)
                        }
                    }
                    uiState.filteredRequests.isEmpty() -> {
                        Column(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(24.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.Center
                        ) {
                            Icon(
                                imageVector = Icons.Outlined.HomeRepairService,
                                contentDescription = null,
                                tint = AppColors.SecondaryText,
                                modifier = Modifier.size(80.dp)
                            )
                            Spacer(modifier = Modifier.height(16.dp))
                            Text(
                                text = "No Service Requests",
                                fontSize = 20.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = AppColors.PrimaryText
                            )
                            Spacer(modifier = Modifier.height(8.dp))
                            Text(
                                text = if (uiState.selectedFilter == RequestFilter.ALL)
                                    "Create a service request when you need help"
                                else
                                    "No ${uiState.selectedFilter.displayName.lowercase()} requests",
                                fontSize = 14.sp,
                                color = AppColors.SecondaryText
                            )
                        }
                    }
                    else -> {
                        LazyColumn(
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 16.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            item { Spacer(modifier = Modifier.height(4.dp)) }
                            
                            items(uiState.filteredRequests) { request ->
                                ServiceRequestCard(
                                    request = request,
                                    onClick = { onRequestClick?.invoke(request) }
                                )
                            }
                            
                            item { Spacer(modifier = Modifier.height(80.dp)) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ServiceRequestCard(
    request: ServiceRequest,
    onClick: () -> Unit
) {
    val dateFormat = remember { SimpleDateFormat("MMM d, yyyy", Locale.getDefault()) }

    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
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
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Status badge
                StatusBadge(status = request.status)
                
                // Priority badge
                PriorityBadge(priority = request.priority)
            }

            Spacer(modifier = Modifier.height(12.dp))

            Text(
                text = request.title?.ifEmpty { "Untitled Request" } ?: "Untitled Request",
                fontSize = 16.sp,
                fontWeight = FontWeight.SemiBold,
                color = AppColors.PrimaryText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(4.dp))

            Text(
                text = request.description?.ifEmpty { "No description" } ?: "No description",
                fontSize = 14.sp,
                color = AppColors.SecondaryText,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Property info
                request.propertyDetails?.let { property ->
                    Text(
                        text = property.title.ifEmpty { "Unknown Property" },
                        fontSize = 12.sp,
                        color = AppColors.SecondaryText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.weight(1f)
                    )
                }

                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Filled.Schedule,
                        contentDescription = null,
                        tint = AppColors.DisabledText,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = dateFormat.format(request.createdAt),
                        fontSize = 12.sp,
                        color = AppColors.DisabledText
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(status: ServiceRequestStatus) {
    val (backgroundColor, textColor) = when (status) {
        ServiceRequestStatus.PENDING -> AppColors.WarningColor.copy(alpha = 0.2f) to AppColors.WarningColor
        ServiceRequestStatus.IN_PROGRESS -> AppColors.InfoColor.copy(alpha = 0.2f) to AppColors.InfoColor
        ServiceRequestStatus.COMPLETED -> AppColors.SuccessColor.copy(alpha = 0.2f) to AppColors.SuccessColor
        ServiceRequestStatus.CANCELLED, ServiceRequestStatus.DECLINED -> 
            AppColors.ErrorColor.copy(alpha = 0.2f) to AppColors.ErrorColor
        ServiceRequestStatus.SCHEDULED -> Color(0xFF6366F1).copy(alpha = 0.2f) to Color(0xFF6366F1)
        ServiceRequestStatus.BIDDING, ServiceRequestStatus.REOPENED_BIDDING -> 
            Color(0xFF8B5CF6).copy(alpha = 0.2f) to Color(0xFF8B5CF6)
        ServiceRequestStatus.ACCEPTED -> AppColors.SuccessColor.copy(alpha = 0.2f) to AppColors.SuccessColor
        ServiceRequestStatus.IN_RESEARCH -> Color(0xFFF97316).copy(alpha = 0.2f) to Color(0xFFF97316)
        ServiceRequestStatus.UNKNOWN -> AppColors.DisabledText.copy(alpha = 0.2f) to AppColors.DisabledText
    }

    Box(
        modifier = Modifier
            .background(backgroundColor, RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = status.name.replace("_", " "),
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            color = textColor
        )
    }
}

@Composable
private fun PriorityBadge(priority: ServiceRequestPriority) {
    val color = when (priority) {
        ServiceRequestPriority.URGENT -> AppColors.ErrorColor
        ServiceRequestPriority.HIGH -> Color(0xFFF97316)
        ServiceRequestPriority.MEDIUM -> AppColors.WarningColor
        ServiceRequestPriority.LOW -> AppColors.SecondaryText
        ServiceRequestPriority.UNKNOWN -> AppColors.DisabledText
    }

    if (priority == ServiceRequestPriority.URGENT || priority == ServiceRequestPriority.HIGH) {
        Box(
            modifier = Modifier
                .background(color.copy(alpha = 0.2f), RoundedCornerShape(4.dp))
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Text(
                text = priority.name,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = color
            )
        }
    }
}
