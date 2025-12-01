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
import androidx.compose.material.icons.automirrored.filled.ArrowBack
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
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.data.model.ServiceRequest
import com.hestami_ai.myhomeagent.data.model.ServiceRequestPriority
import com.hestami_ai.myhomeagent.data.model.ServiceRequestStatus
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import com.hestami_ai.myhomeagent.ui.viewmodel.RequestFilter
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Screen showing service requests for a specific property.
 */
@Suppress("UNNECESSARY_SAFE_CALL")
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PropertyServiceRequestsScreen(
    property: Property,
    onNavigateBack: () -> Unit,
    onRequestClick: (ServiceRequest) -> Unit,
    onCreateRequestClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val requests = property.serviceRequests ?: emptyList()
    var selectedFilter by remember { mutableStateOf(RequestFilter.ALL) }
    var isRefreshing by remember { mutableStateOf(false) }
    
    val filteredRequests = when (selectedFilter) {
        RequestFilter.ALL -> requests
        RequestFilter.PENDING -> requests.filter { 
            it.status == ServiceRequestStatus.PENDING || 
            it.status == ServiceRequestStatus.BIDDING 
        }
        RequestFilter.IN_PROGRESS -> requests.filter { 
            it.status == ServiceRequestStatus.IN_PROGRESS || 
            it.status == ServiceRequestStatus.SCHEDULED ||
            it.status == ServiceRequestStatus.ACCEPTED
        }
        RequestFilter.COMPLETED -> requests.filter { 
            it.status == ServiceRequestStatus.COMPLETED 
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Service Requests",
                            color = AppColors.PrimaryText,
                            fontWeight = FontWeight.Bold,
                            fontSize = 18.sp
                        )
                        Text(
                            text = property.title ?: "Property",
                            color = AppColors.SecondaryText,
                            fontSize = 12.sp
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                            contentDescription = "Back",
                            tint = AppColors.PrimaryText
                        )
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = AppColors.PrimaryBackground
                )
            )
        },
        floatingActionButton = {
            FloatingActionButton(
                onClick = onCreateRequestClick,
                containerColor = AppColors.AccentPrimary,
                contentColor = AppColors.PrimaryText
            ) {
                Icon(Icons.Default.Add, contentDescription = "Create Request")
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
                        selected = selectedFilter == filter,
                        onClick = { selectedFilter = filter },
                        label = { Text(filter.displayName) },
                        colors = FilterChipDefaults.filterChipColors(
                            selectedContainerColor = AppColors.AccentPrimary,
                            selectedLabelColor = AppColors.PrimaryText,
                            containerColor = AppColors.CardBackground,
                            labelColor = AppColors.SecondaryText
                        )
                    )
                }
            }

            // Request count
            Text(
                text = "${filteredRequests.size} request${if (filteredRequests.size != 1) "s" else ""}",
                color = AppColors.SecondaryText,
                fontSize = 14.sp,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
            )

            // Requests list
            PullToRefreshBox(
                isRefreshing = isRefreshing,
                onRefresh = { 
                    // Note: In a real implementation, this would refresh from the API
                    isRefreshing = false 
                },
                modifier = Modifier.fillMaxSize()
            ) {
                if (filteredRequests.isEmpty()) {
                    EmptyRequestsState(
                        filter = selectedFilter,
                        modifier = Modifier.fillMaxSize()
                    )
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        items(filteredRequests, key = { it.id }) { request ->
                            ServiceRequestCard(
                                request = request,
                                onClick = { onRequestClick(request) }
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptyRequestsState(
    filter: RequestFilter,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier,
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Icon(
                imageVector = Icons.Outlined.HomeRepairService,
                contentDescription = null,
                tint = AppColors.SecondaryText,
                modifier = Modifier.size(64.dp)
            )
            Spacer(modifier = Modifier.height(16.dp))
            Text(
                text = when (filter) {
                    RequestFilter.ALL -> "No service requests"
                    RequestFilter.PENDING -> "No pending requests"
                    RequestFilter.IN_PROGRESS -> "No requests in progress"
                    RequestFilter.COMPLETED -> "No completed requests"
                },
                color = AppColors.SecondaryText,
                fontSize = 16.sp
            )
            Spacer(modifier = Modifier.height(8.dp))
            Text(
                text = "Tap + to create a new request",
                color = AppColors.DisabledText,
                fontSize = 14.sp
            )
        }
    }
}

@Composable
private fun ServiceRequestCard(
    request: ServiceRequest,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        colors = CardDefaults.cardColors(containerColor = AppColors.CardBackground),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.Top
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = request.title ?: "Untitled Request",
                        color = AppColors.PrimaryText,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis
                    )
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = request.categoryDisplay ?: request.category ?: "Unknown",
                        color = AppColors.SecondaryText,
                        fontSize = 14.sp
                    )
                }
                Spacer(modifier = Modifier.width(8.dp))
                StatusBadge(status = request.status)
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                // Priority
                PriorityIndicator(priority = request.priority)

                // Date
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.Schedule,
                        contentDescription = null,
                        tint = AppColors.SecondaryText,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = formatDate(request.createdAt),
                        color = AppColors.SecondaryText,
                        fontSize = 12.sp
                    )
                }
            }
        }
    }
}

@Composable
private fun StatusBadge(status: ServiceRequestStatus) {
    val (backgroundColor, textColor) = when (status) {
        ServiceRequestStatus.PENDING -> AppColors.WarningColor to Color.Black
        ServiceRequestStatus.BIDDING -> AppColors.InfoColor to Color.White
        ServiceRequestStatus.REOPENED_BIDDING -> AppColors.InfoColor to Color.White
        ServiceRequestStatus.ACCEPTED -> AppColors.AccentPrimary to Color.White
        ServiceRequestStatus.SCHEDULED -> AppColors.AccentPrimary to Color.White
        ServiceRequestStatus.IN_PROGRESS -> AppColors.InfoColor to Color.White
        ServiceRequestStatus.IN_RESEARCH -> AppColors.InfoColor to Color.White
        ServiceRequestStatus.COMPLETED -> AppColors.SuccessColor to Color.White
        ServiceRequestStatus.CANCELLED -> AppColors.ErrorColor to Color.White
        ServiceRequestStatus.DECLINED -> AppColors.ErrorColor to Color.White
        ServiceRequestStatus.UNKNOWN -> AppColors.DisabledText to Color.White
    }

    Box(
        modifier = Modifier
            .background(backgroundColor, RoundedCornerShape(4.dp))
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = status.name.replace("_", " ").lowercase().replaceFirstChar { it.uppercase() },
            color = textColor,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium
        )
    }
}

@Composable
private fun PriorityIndicator(priority: ServiceRequestPriority) {
    val color = when (priority) {
        ServiceRequestPriority.LOW -> AppColors.SuccessColor
        ServiceRequestPriority.MEDIUM -> AppColors.WarningColor
        ServiceRequestPriority.HIGH -> AppColors.ErrorColor
        ServiceRequestPriority.URGENT -> AppColors.ErrorColor
        ServiceRequestPriority.UNKNOWN -> AppColors.DisabledText
    }

    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .background(color, RoundedCornerShape(4.dp))
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = priority.name.lowercase().replaceFirstChar { it.uppercase() },
            color = AppColors.SecondaryText,
            fontSize = 12.sp
        )
    }
}

private fun formatDate(date: java.util.Date): String {
    val formatter = SimpleDateFormat("MMM d, yyyy", Locale.getDefault())
    return formatter.format(date)
}
