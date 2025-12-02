package com.hestami_ai.myhomeagent.ui.screens.requests

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Category
import androidx.compose.material.icons.filled.Flag
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.outlined.Cottage
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hestami_ai.myhomeagent.data.model.ServiceRequest
import com.hestami_ai.myhomeagent.data.model.ServiceRequestPriority
import com.hestami_ai.myhomeagent.data.model.ServiceRequestStatus
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import java.text.SimpleDateFormat
import java.util.Locale

/**
 * Service request detail screen matching iOS RequestDetailView.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ServiceRequestDetailScreen(
    request: ServiceRequest,
    onNavigateBack: () -> Unit,
    onCancelRequest: ((String) -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    var showCancelDialog by remember { mutableStateOf(false) }
    val dateFormat = remember { SimpleDateFormat("MMM d, yyyy 'at' h:mm a", Locale.getDefault()) }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Request Details",
                        color = AppColors.PrimaryText,
                        fontWeight = FontWeight.Bold
                    )
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
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(AppColors.PrimaryBackground)
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Status Header Card
            DetailCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = request.title?.ifEmpty { "Untitled Request" } ?: "Untitled Request",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                            color = AppColors.PrimaryText
                        )
                        Spacer(modifier = Modifier.height(4.dp))
                        Text(
                            text = dateFormat.format(request.createdAt),
                            fontSize = 12.sp,
                            color = AppColors.SecondaryText
                        )
                    }
                    Spacer(modifier = Modifier.width(12.dp))
                    StatusBadge(status = request.status)
                }
            }

            // Property Card
            DetailCard {
                Column {
                    Text(
                        text = "Property",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.PrimaryText
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    request.propertyDetails?.let { property ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Outlined.Cottage,
                                contentDescription = null,
                                tint = AppColors.SecondaryText,
                                modifier = Modifier.size(20.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = property.title.ifEmpty { "Unknown Property" },
                                fontSize = 16.sp,
                                color = AppColors.PrimaryText
                            )
                        }
                        Spacer(modifier = Modifier.height(4.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                imageVector = Icons.Filled.LocationOn,
                                contentDescription = null,
                                tint = AppColors.SecondaryText,
                                modifier = Modifier.size(16.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text(
                                text = listOfNotNull(
                                    property.address.ifEmpty { null },
                                    property.city.ifEmpty { null },
                                    "${property.state.ifEmpty { "" }} ${property.zipCode.ifEmpty { "" }}".trim().ifEmpty { null }
                                ).joinToString(", ").ifEmpty { "Address not available" },
                                fontSize = 14.sp,
                                color = AppColors.SecondaryText
                            )
                        }
                    } ?: run {
                        Text(
                            text = "Property ID: ${request.property}",
                            fontSize = 14.sp,
                            color = AppColors.SecondaryText
                        )
                    }
                }
            }

            // Details Card (Category & Priority)
            DetailCard {
                Column {
                    Text(
                        text = "Details",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.PrimaryText
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    DetailRow(
                        icon = Icons.Filled.Category,
                        label = "Category",
                        value = request.categoryDisplay?.ifEmpty { null } ?: request.category.ifEmpty { "Unknown" }
                    )
                    
                    Spacer(modifier = Modifier.height(8.dp))
                    
                    DetailRow(
                        icon = Icons.Filled.Flag,
                        label = "Priority",
                        value = request.priority.name.replace("_", " "),
                        valueColor = priorityColor(request.priority)
                    )
                    
                    request.providerDetails?.let { provider ->
                        Spacer(modifier = Modifier.height(8.dp))
                        DetailRow(
                            label = "Provider",
                            value = provider.businessName.ifEmpty { "Unknown Provider" }
                        )
                    }
                }
            }

            // Description Card
            DetailCard {
                Column {
                    Text(
                        text = "Description",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.PrimaryText
                    )
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = request.description?.ifEmpty { "No description provided" } ?: "No description provided",
                        fontSize = 14.sp,
                        color = AppColors.SecondaryText,
                        lineHeight = 20.sp
                    )
                }
            }

            // Schedule Card
            DetailCard {
                Column {
                    Text(
                        text = "Schedule",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.PrimaryText
                    )
                    Spacer(modifier = Modifier.height(12.dp))
                    
                    ScheduleRow(
                        icon = Icons.Filled.CalendarMonth,
                        label = "Created",
                        date = dateFormat.format(request.createdAt)
                    )
                    
                    request.scheduledStart?.let { date ->
                        Spacer(modifier = Modifier.height(8.dp))
                        ScheduleRow(
                            label = "Scheduled Start",
                            date = dateFormat.format(date)
                        )
                    }
                    
                    request.scheduledEnd?.let { date ->
                        Spacer(modifier = Modifier.height(8.dp))
                        ScheduleRow(
                            label = "Scheduled End",
                            date = dateFormat.format(date)
                        )
                    }
                    
                    request.actualStart?.let { date ->
                        Spacer(modifier = Modifier.height(8.dp))
                        ScheduleRow(
                            label = "Actual Start",
                            date = dateFormat.format(date)
                        )
                    }
                    
                    request.actualEnd?.let { date ->
                        Spacer(modifier = Modifier.height(8.dp))
                        ScheduleRow(
                            label = "Actual End",
                            date = dateFormat.format(date)
                        )
                    }
                }
            }

            // Cancel Button (only for certain statuses)
            if (request.status == ServiceRequestStatus.PENDING ||
                request.status == ServiceRequestStatus.IN_PROGRESS ||
                request.status == ServiceRequestStatus.SCHEDULED
            ) {
                Spacer(modifier = Modifier.height(8.dp))
                Button(
                    onClick = { showCancelDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppColors.ErrorColor
                    ),
                    shape = RoundedCornerShape(10.dp)
                ) {
                    Text(
                        text = "Cancel Request",
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }
            
            Spacer(modifier = Modifier.height(16.dp))
        }
    }

    // Cancel Confirmation Dialog
    if (showCancelDialog) {
        AlertDialog(
            onDismissRequest = { showCancelDialog = false },
            title = {
                Text(
                    text = "Cancel Service Request",
                    color = AppColors.PrimaryText
                )
            },
            text = {
                Text(
                    text = "Are you sure you want to cancel this service request? This action cannot be undone.",
                    color = AppColors.SecondaryText
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showCancelDialog = false
                        onCancelRequest?.invoke(request.id)
                    }
                ) {
                    Text(
                        text = "Cancel Request",
                        color = AppColors.ErrorColor
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showCancelDialog = false }) {
                    Text(
                        text = "Keep Request",
                        color = AppColors.SecondaryText
                    )
                }
            },
            containerColor = AppColors.CardBackground
        )
    }
}

@Composable
private fun DetailCard(
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = AppColors.CardBackground
        ),
        shape = RoundedCornerShape(12.dp)
    ) {
        Box(modifier = Modifier.padding(16.dp)) {
            content()
        }
    }
}

@Composable
private fun DetailRow(
    icon: ImageVector? = null,
    label: String,
    value: String,
    valueColor: Color = AppColors.PrimaryText
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            icon?.let {
                Icon(
                    imageVector = it,
                    contentDescription = null,
                    tint = AppColors.SecondaryText,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(
                text = "$label:",
                fontSize = 14.sp,
                color = AppColors.SecondaryText
            )
        }
        Text(
            text = value,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = valueColor
        )
    }
}

@Composable
private fun ScheduleRow(
    icon: ImageVector? = null,
    label: String,
    date: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            icon?.let {
                Icon(
                    imageVector = it,
                    contentDescription = null,
                    tint = AppColors.SecondaryText,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
            }
            Text(
                text = "$label:",
                fontSize = 14.sp,
                color = AppColors.SecondaryText
            )
        }
        Text(
            text = date,
            fontSize = 14.sp,
            color = AppColors.PrimaryText
        )
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
            .background(backgroundColor, RoundedCornerShape(8.dp))
            .padding(horizontal = 12.dp, vertical = 6.dp)
    ) {
        Text(
            text = status.name.replace("_", " "),
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = textColor
        )
    }
}

private fun priorityColor(priority: ServiceRequestPriority): Color {
    return when (priority) {
        ServiceRequestPriority.URGENT -> Color(0xFFEF4444)
        ServiceRequestPriority.HIGH -> Color(0xFFF97316)
        ServiceRequestPriority.MEDIUM -> Color(0xFFEAB308)
        ServiceRequestPriority.LOW -> Color(0xFF22C55E)
        ServiceRequestPriority.UNKNOWN -> Color(0xFF6B7280)
    }
}
