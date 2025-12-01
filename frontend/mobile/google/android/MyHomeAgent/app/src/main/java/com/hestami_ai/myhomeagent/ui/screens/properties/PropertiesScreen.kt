package com.hestami_ai.myhomeagent.ui.screens.properties

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.outlined.Cottage
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.data.network.NetworkModule
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import com.hestami_ai.myhomeagent.ui.viewmodel.PropertiesViewModel

/**
 * Properties screen matching iOS PropertiesView.swift.
 * Lists all user properties with ability to add new ones.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PropertiesScreen(
    modifier: Modifier = Modifier,
    onPropertyClick: ((Property) -> Unit)? = null,
    onAddPropertyClick: () -> Unit = {},
    viewModel: PropertiesViewModel = viewModel()
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
                        text = "My Properties",
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
                onClick = onAddPropertyClick,
                containerColor = AppColors.SuccessColor,
                contentColor = AppColors.PrimaryText
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = "Add Property"
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
        PullToRefreshBox(
            isRefreshing = uiState.isRefreshing,
            onRefresh = { viewModel.refreshProperties() },
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when {
                uiState.isLoading && uiState.properties.isEmpty() -> {
                    // Loading state
                    Box(
                        modifier = Modifier.fillMaxSize(),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator(
                            color = AppColors.SuccessColor
                        )
                    }
                }
                uiState.properties.isEmpty() -> {
                    // Empty state
                    Column(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(24.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.Center
                    ) {
                        Icon(
                            imageVector = Icons.Outlined.Cottage,
                            contentDescription = null,
                            tint = AppColors.SecondaryText,
                            modifier = Modifier.size(80.dp)
                        )
                        Spacer(modifier = Modifier.height(16.dp))
                        Text(
                            text = "No Properties Yet",
                            fontSize = 20.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = AppColors.PrimaryText
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Add your first property to get started",
                            fontSize = 14.sp,
                            color = AppColors.SecondaryText
                        )
                    }
                }
                else -> {
                    // Properties list
                    LazyColumn(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(horizontal = 16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        item { Spacer(modifier = Modifier.height(8.dp)) }
                        
                        items(uiState.properties) { property ->
                            PropertyCard(
                                property = property,
                                onClick = { onPropertyClick?.invoke(property) }
                            )
                        }
                        
                        item { Spacer(modifier = Modifier.height(80.dp)) } // FAB spacing
                    }
                }
            }
        }
    }
}

@Composable
private fun PropertyCard(
    property: Property,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
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
            // Property image or placeholder
            Box(
                modifier = Modifier
                    .size(80.dp)
                    .clip(RoundedCornerShape(8.dp))
                    .background(AppColors.SecondaryBackground),
                contentAlignment = Alignment.Center
            ) {
                if (property.featuredImage != null) {
                    AsyncImage(
                        model = NetworkModule.rewriteMediaUrl(property.featuredImage),
                        contentDescription = property.title,
                        modifier = Modifier.fillMaxSize(),
                        contentScale = ContentScale.Crop
                    )
                } else {
                    Icon(
                        imageVector = Icons.Outlined.Cottage,
                        contentDescription = null,
                        tint = AppColors.SecondaryText,
                        modifier = Modifier.size(32.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.width(12.dp))

            // Property info
            Column(
                modifier = Modifier.weight(1f)
            ) {
                Text(
                    text = property.title,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.PrimaryText,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                
                Spacer(modifier = Modifier.height(4.dp))
                
                Row(
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Icon(
                        imageVector = Icons.Default.LocationOn,
                        contentDescription = null,
                        tint = AppColors.SecondaryText,
                        modifier = Modifier.size(14.dp)
                    )
                    Spacer(modifier = Modifier.width(4.dp))
                    Text(
                        text = "${property.city}, ${property.state}",
                        fontSize = 14.sp,
                        color = AppColors.SecondaryText,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis
                    )
                }

                Spacer(modifier = Modifier.height(4.dp))

                // Status badge
                Text(
                    text = property.status.name.replace("_", " "),
                    fontSize = 12.sp,
                    color = when (property.status.name) {
                        "ACTIVE" -> AppColors.SuccessColor
                        "PENDING", "COUNTY_PROCESSING" -> AppColors.WarningColor
                        else -> AppColors.SecondaryText
                    }
                )
            }

            Icon(
                imageVector = Icons.Filled.ChevronRight,
                contentDescription = "View details",
                tint = AppColors.SecondaryText
            )
        }
    }
}
