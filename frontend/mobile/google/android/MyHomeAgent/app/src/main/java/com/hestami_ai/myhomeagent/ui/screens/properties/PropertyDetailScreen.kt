package com.hestami_ai.myhomeagent.ui.screens.properties

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Bathtub
import androidx.compose.material.icons.filled.Bed
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.ElectricBolt
import androidx.compose.material.icons.filled.GridView
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.PhotoLibrary
import androidx.compose.material.icons.filled.Roofing
import androidx.compose.material.icons.filled.SquareFoot
import androidx.compose.material.icons.filled.Thermostat
import androidx.compose.material.icons.filled.ViewInAr
import androidx.compose.material.icons.filled.WbSunny
import androidx.compose.material.icons.outlined.Cottage
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.data.model.PropertyDescriptives
import com.hestami_ai.myhomeagent.data.model.ServiceRequest
import com.hestami_ai.myhomeagent.data.model.Media
import com.hestami_ai.myhomeagent.data.model.ServiceRequestStatus
import com.hestami_ai.myhomeagent.data.network.NetworkModule
import com.hestami_ai.myhomeagent.ui.screens.properties.components.ActionButtonView
import com.hestami_ai.myhomeagent.ui.screens.properties.components.DetailRow
import com.hestami_ai.myhomeagent.ui.screens.properties.components.ExpandableDetailSection
import com.hestami_ai.myhomeagent.ui.screens.properties.components.PropertyStatView
import com.hestami_ai.myhomeagent.ui.screens.properties.media.PropertyMediaGallery
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import com.hestami_ai.myhomeagent.utils.PropertyValueMapper

/**
 * Property detail screen matching iOS PropertyDetailView.swift.
 * Enhanced with expandable sections, media gallery, and action buttons.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PropertyDetailScreen(
    property: Property,
    onNavigateBack: () -> Unit,
    modifier: Modifier = Modifier,
    onEditClick: () -> Unit = {},
    onUploadMediaClick: () -> Unit = {},
    onManageMediaClick: () -> Unit = {},
    onScanPropertyClick: () -> Unit = {},
    onViewRequestsClick: () -> Unit = {},
    onRequestClick: (ServiceRequest) -> Unit = {},
    onMediaClick: (Media) -> Unit = {}
) {
    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = property.title,
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
        },
        containerColor = AppColors.PrimaryBackground
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .verticalScroll(rememberScrollState())
        ) {
            // Property image
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(200.dp)
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
                        modifier = Modifier.size(64.dp)
                    )
                }
            }

            Column(
                modifier = Modifier.padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Status badge and address section
                StatusAndAddressSection(property)

                // Description
                if (property.description.isNotBlank()) {
                    DescriptionSection(property.description)
                }

                // Key Stats Grid
                property.descriptives?.let { descriptives ->
                    KeyStatsSection(descriptives)
                }

                // Expandable Property Details Sections
                property.descriptives?.let { descriptives ->
                    ExpandablePropertySections(descriptives)
                }

                // Media Gallery Section
                MediaGallerySection(
                    property = property,
                    onMediaClick = onMediaClick
                )

                // Service Requests Section
                ServiceRequestsSection(
                    property = property,
                    onViewRequestsClick = onViewRequestsClick,
                    onRequestClick = onRequestClick
                )

                // Action Buttons
                ActionButtonsSection(
                    property = property,
                    onEditClick = onEditClick,
                    onUploadMediaClick = onUploadMediaClick,
                    onManageMediaClick = onManageMediaClick,
                    onScanPropertyClick = onScanPropertyClick,
                    onViewRequestsClick = onViewRequestsClick
                )

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

@Composable
private fun StatusAndAddressSection(property: Property) {
    Column {
        // Status badge
        Box(
            modifier = Modifier
                .background(
                    when (property.status.name) {
                        "ACTIVE" -> AppColors.SuccessColor.copy(alpha = 0.2f)
                        "PENDING", "COUNTY_PROCESSING" -> AppColors.WarningColor.copy(alpha = 0.2f)
                        else -> AppColors.SecondaryText.copy(alpha = 0.2f)
                    },
                    RoundedCornerShape(4.dp)
                )
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Text(
                text = property.status.name.replace("_", " "),
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = when (property.status.name) {
                    "ACTIVE" -> AppColors.SuccessColor
                    "PENDING", "COUNTY_PROCESSING" -> AppColors.WarningColor
                    else -> AppColors.SecondaryText
                }
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Address
        Row(verticalAlignment = Alignment.Top) {
            Icon(
                imageVector = Icons.Default.LocationOn,
                contentDescription = null,
                tint = AppColors.SecondaryText,
                modifier = Modifier.size(20.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Column {
                Text(
                    text = property.address,
                    fontSize = 16.sp,
                    color = AppColors.PrimaryText
                )
                Text(
                    text = "${property.city}, ${property.state} ${property.zipCode}",
                    fontSize = 14.sp,
                    color = AppColors.SecondaryText
                )
                property.county?.let { county ->
                    Text(
                        text = "$county, ${property.country}",
                        fontSize = 14.sp,
                        color = AppColors.SecondaryText
                    )
                }
            }
        }

        // Property Type
        property.descriptives?.propertyType?.let { propertyType ->
            Spacer(modifier = Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    imageVector = Icons.Default.Home,
                    contentDescription = null,
                    tint = AppColors.SecondaryText,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = PropertyValueMapper.displayValue(propertyType),
                    fontSize = 14.sp,
                    color = AppColors.SecondaryText
                )
            }
        }
    }
}

@Composable
private fun DescriptionSection(description: String) {
    Column {
        HorizontalDivider(color = AppColors.BorderColor)
        Spacer(modifier = Modifier.height(16.dp))
        Text(
            text = "Description",
            fontSize = 16.sp,
            fontWeight = FontWeight.SemiBold,
            color = AppColors.PrimaryText
        )
        Spacer(modifier = Modifier.height(8.dp))
        Text(
            text = description,
            fontSize = 14.sp,
            color = AppColors.SecondaryText
        )
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun KeyStatsSection(descriptives: PropertyDescriptives) {
    val hasStats = descriptives.squareFootage != null ||
            descriptives.bedrooms != null ||
            descriptives.bathrooms != null ||
            descriptives.yearBuilt != null

    if (hasStats) {
        Card(
            modifier = Modifier.fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = AppColors.CardBackground),
            shape = RoundedCornerShape(12.dp)
        ) {
            Column(modifier = Modifier.padding(16.dp)) {
                Text(
                    text = "Property Details",
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.PrimaryText
                )
                Spacer(modifier = Modifier.height(16.dp))

                FlowRow(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly,
                    verticalArrangement = Arrangement.spacedBy(16.dp)
                ) {
                    descriptives.squareFootage?.let {
                        PropertyStatView(
                            icon = Icons.Filled.SquareFoot,
                            title = "Square Footage",
                            value = "%,d sq ft".format(it)
                        )
                    }
                    descriptives.bedrooms?.let {
                        PropertyStatView(
                            icon = Icons.Filled.Bed,
                            title = "Bedrooms",
                            value = it.toString()
                        )
                    }
                    descriptives.bathrooms?.let {
                        PropertyStatView(
                            icon = Icons.Filled.Bathtub,
                            title = "Bathrooms",
                            value = it
                        )
                    }
                    descriptives.yearBuilt?.let {
                        PropertyStatView(
                            icon = Icons.Filled.CalendarMonth,
                            title = "Year Built",
                            value = it.toString()
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ExpandablePropertySections(descriptives: PropertyDescriptives) {
    // Structure & Features
    if (hasStructureFeatures(descriptives)) {
        ExpandableDetailSection(
            title = "Structure & Features",
            icon = Icons.Default.Home
        ) {
            StructureFeaturesContent(descriptives)
        }
    }

    // HVAC & Climate
    if (hasHvacDetails(descriptives)) {
        ExpandableDetailSection(
            title = "HVAC & Climate",
            icon = Icons.Default.Thermostat
        ) {
            HvacClimateContent(descriptives)
        }
    }

    // Exterior & Roofing
    if (hasExteriorDetails(descriptives)) {
        ExpandableDetailSection(
            title = "Exterior & Roofing",
            icon = Icons.Default.Roofing
        ) {
            ExteriorRoofingContent(descriptives)
        }
    }

    // Utilities & Systems
    if (hasUtilitiesDetails(descriptives)) {
        ExpandableDetailSection(
            title = "Utilities & Systems",
            icon = Icons.Default.ElectricBolt
        ) {
            UtilitiesSystemsContent(descriptives)
        }
    }

    // Outdoor Features
    if (hasOutdoorFeatures(descriptives)) {
        ExpandableDetailSection(
            title = "Outdoor Features",
            icon = Icons.Default.WbSunny
        ) {
            OutdoorFeaturesContent(descriptives)
        }
    }
}

@Composable
private fun StructureFeaturesContent(descriptives: PropertyDescriptives) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        descriptives.stories?.let {
            DetailRow(label = "Stories", value = it.toString())
        }
        descriptives.lotSize?.let {
            DetailRow(label = "Lot Size", value = it)
        }
        if (descriptives.basement == true) {
            DetailRow(label = "Basement", value = "Yes")
            descriptives.basementType?.let {
                DetailRow(label = "Basement Type", value = PropertyValueMapper.displayValue(it), indented = true)
            }
        }
        if (descriptives.garage == true) {
            DetailRow(label = "Garage", value = "Yes")
            descriptives.garageType?.let {
                DetailRow(label = "Garage Type", value = PropertyValueMapper.displayValue(it), indented = true)
            }
            descriptives.garageSpaces?.let {
                DetailRow(label = "Garage Spaces", value = it.toString(), indented = true)
            }
        }
        if (descriptives.attic == true) {
            DetailRow(label = "Attic", value = "Yes")
            descriptives.atticAccess?.let {
                DetailRow(label = "Attic Access", value = PropertyValueMapper.displayValue(it), indented = true)
            }
        }
        if (descriptives.crawlSpace == true) {
            DetailRow(label = "Crawl Space", value = "Yes")
        }
        if (descriptives.fireplace == true) {
            DetailRow(label = "Fireplace", value = "Yes")
            descriptives.fireplaceType?.let {
                DetailRow(label = "Fireplace Type", value = PropertyValueMapper.displayValue(it), indented = true)
            }
        }
    }
}

@Composable
private fun HvacClimateContent(descriptives: PropertyDescriptives) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        descriptives.heatingSystem?.let {
            DetailRow(label = "Heating System", value = PropertyValueMapper.displayValue(it))
        }
        descriptives.heatingFuel?.let {
            DetailRow(label = "Heating Fuel", value = PropertyValueMapper.displayValue(it))
        }
        descriptives.coolingSystem?.let {
            DetailRow(label = "Cooling System", value = PropertyValueMapper.displayValue(it))
        }
        if (descriptives.airConditioning == true) {
            DetailRow(label = "Air Conditioning", value = "Yes")
        }
        descriptives.hvacAge?.let {
            DetailRow(label = "HVAC Age", value = "$it years")
        }
        descriptives.hvacBrand?.let {
            DetailRow(label = "HVAC Brand", value = it)
        }
        descriptives.thermostatType?.let {
            DetailRow(label = "Thermostat", value = PropertyValueMapper.displayValue(it))
        }
    }
}

@Composable
private fun ExteriorRoofingContent(descriptives: PropertyDescriptives) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        descriptives.roofType?.let {
            DetailRow(label = "Roof Type", value = PropertyValueMapper.displayValue(it))
        }
        descriptives.roofAge?.let {
            DetailRow(label = "Roof Age", value = it)
        }
        descriptives.exteriorMaterial?.let {
            DetailRow(label = "Exterior Material", value = PropertyValueMapper.displayValue(it))
        }
        descriptives.foundationType?.let {
            DetailRow(label = "Foundation", value = PropertyValueMapper.displayValue(it))
        }
        if (descriptives.fence == true) {
            DetailRow(label = "Fence", value = "Yes")
            descriptives.fenceType?.let {
                DetailRow(label = "Fence Type", value = PropertyValueMapper.displayValue(it), indented = true)
            }
        }
    }
}

@Composable
private fun UtilitiesSystemsContent(descriptives: PropertyDescriptives) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        descriptives.waterSource?.let {
            DetailRow(label = "Water Source", value = PropertyValueMapper.displayValue(it))
        }
        descriptives.sewerSystem?.let {
            DetailRow(label = "Sewer System", value = PropertyValueMapper.displayValue(it))
        }
        if (descriptives.gasService == true) {
            DetailRow(label = "Gas Service", value = "Yes")
        }
        descriptives.electricalPanel?.let {
            DetailRow(label = "Electrical Panel", value = PropertyValueMapper.displayValue(it))
        }
        descriptives.electricalAmps?.let {
            DetailRow(label = "Electrical Amps", value = "${it}A")
        }
        descriptives.waterHeater?.let { waterHeater ->
            waterHeater.type?.let {
                DetailRow(label = "Water Heater Type", value = PropertyValueMapper.displayValue(it))
            }
            waterHeater.fuel?.let {
                DetailRow(label = "Water Heater Fuel", value = PropertyValueMapper.displayValue(it), indented = true)
            }
            waterHeater.age?.let {
                DetailRow(label = "Water Heater Age", value = "$it years", indented = true)
            }
        }
    }
}

@Composable
private fun OutdoorFeaturesContent(descriptives: PropertyDescriptives) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (descriptives.pool == true) {
            DetailRow(label = "Pool", value = "Yes")
            descriptives.poolType?.let {
                DetailRow(label = "Pool Type", value = PropertyValueMapper.displayValue(it), indented = true)
            }
        }
        if (descriptives.patio == true) {
            DetailRow(label = "Patio", value = "Yes")
            descriptives.patioMaterial?.let {
                DetailRow(label = "Patio Material", value = PropertyValueMapper.displayValue(it), indented = true)
            }
        }
        if (descriptives.deck == true) {
            DetailRow(label = "Deck", value = "Yes")
            descriptives.deckMaterial?.let {
                DetailRow(label = "Deck Material", value = PropertyValueMapper.displayValue(it), indented = true)
            }
        }
        if (descriptives.sprinklerSystem == true) {
            DetailRow(label = "Sprinkler System", value = "Yes")
        }
    }
}

@Composable
private fun MediaGallerySection(
    property: Property,
    onMediaClick: (Media) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = AppColors.CardBackground),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.Default.PhotoLibrary,
                        contentDescription = null,
                        tint = AppColors.AccentPrimary,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Media Gallery",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.PrimaryText
                    )
                }
                Text(
                    text = "${property.mediaCount} items",
                    fontSize = 14.sp,
                    color = AppColors.SecondaryText
                )
            }

            if (property.media.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "No media uploaded yet",
                    fontSize = 14.sp,
                    color = AppColors.DisabledText
                )
            } else {
                Spacer(modifier = Modifier.height(12.dp))
                PropertyMediaGallery(
                    media = property.media,
                    onMediaClick = onMediaClick
                )
            }
        }
    }
}

@Suppress("UNUSED_PARAMETER")
@Composable
private fun ServiceRequestsSection(
    property: Property,
    onViewRequestsClick: () -> Unit,
    onRequestClick: (ServiceRequest) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = AppColors.CardBackground),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.List,
                        contentDescription = null,
                        tint = AppColors.AccentPrimary,
                        modifier = Modifier.size(24.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Service Requests",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = AppColors.PrimaryText
                    )
                }
                Text(
                    text = "${property.serviceRequests?.size ?: 0}",
                    fontSize = 14.sp,
                    color = AppColors.SecondaryText
                )
            }

            if (property.serviceRequests.isNullOrEmpty()) {
                Spacer(modifier = Modifier.height(16.dp))
                Text(
                    text = "No service requests for this property",
                    fontSize = 14.sp,
                    color = AppColors.DisabledText
                )
            } else {
                // Show first few requests
                Spacer(modifier = Modifier.height(8.dp))
                property.serviceRequests.take(3).forEach { request ->
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 8.dp),
                        color = AppColors.BorderColor
                    )
                    ServiceRequestPreviewRow(
                        request = request,
                        onClick = { onRequestClick(request) }
                    )
                }
                if (property.serviceRequests.size > 3) {
                    HorizontalDivider(
                        modifier = Modifier.padding(vertical = 8.dp),
                        color = AppColors.BorderColor
                    )
                    Text(
                        text = "+ ${property.serviceRequests.size - 3} more requests",
                        fontSize = 14.sp,
                        color = AppColors.AccentPrimary,
                        modifier = Modifier.padding(vertical = 4.dp)
                    )
                }
            }
        }
    }
}

@Composable
private fun ServiceRequestPreviewRow(
    request: ServiceRequest,
    onClick: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = request.title?.ifEmpty { "Untitled Request" } ?: "Untitled Request",
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                color = AppColors.PrimaryText
            )
            Text(
                text = request.category.ifEmpty { "Unknown" },
                fontSize = 12.sp,
                color = AppColors.SecondaryText
            )
        }
        Box(
            modifier = Modifier
                .background(
                    when (request.status) {
                        ServiceRequestStatus.PENDING -> AppColors.WarningColor.copy(alpha = 0.2f)
                        ServiceRequestStatus.IN_PROGRESS -> AppColors.AccentPrimary.copy(alpha = 0.2f)
                        ServiceRequestStatus.COMPLETED -> AppColors.SuccessColor.copy(alpha = 0.2f)
                        ServiceRequestStatus.CANCELLED -> AppColors.ErrorColor.copy(alpha = 0.2f)
                        else -> AppColors.SecondaryText.copy(alpha = 0.2f)
                    },
                    RoundedCornerShape(4.dp)
                )
                .padding(horizontal = 8.dp, vertical = 4.dp)
        ) {
            Text(
                text = request.status.name.replace("_", " "),
                fontSize = 10.sp,
                fontWeight = FontWeight.Medium,
                color = when (request.status) {
                    ServiceRequestStatus.PENDING -> AppColors.WarningColor
                    ServiceRequestStatus.IN_PROGRESS -> AppColors.AccentPrimary
                    ServiceRequestStatus.COMPLETED -> AppColors.SuccessColor
                    ServiceRequestStatus.CANCELLED -> AppColors.ErrorColor
                    else -> AppColors.SecondaryText
                }
            )
        }
    }
}

@Composable
private fun ActionButtonsSection(
    property: Property,
    onEditClick: () -> Unit,
    onUploadMediaClick: () -> Unit,
    onManageMediaClick: () -> Unit,
    onScanPropertyClick: () -> Unit,
    onViewRequestsClick: () -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        HorizontalDivider(color = AppColors.BorderColor)

        ActionButtonView(
            icon = Icons.Default.Edit,
            title = "Edit Property",
            onClick = onEditClick
        )

        ActionButtonView(
            icon = Icons.Default.PhotoLibrary,
            title = "Upload Media",
            onClick = onUploadMediaClick,
            badge = if (property.mediaCount > 0) property.mediaCount.toString() else null
        )

        if (property.mediaCount > 0) {
            ActionButtonView(
                icon = Icons.Default.GridView,
                title = "Manage Media",
                onClick = onManageMediaClick
            )
        }

        ActionButtonView(
            icon = Icons.Default.ViewInAr,
            title = "Scan Property",
            onClick = onScanPropertyClick
        )

        ActionButtonView(
            icon = Icons.AutoMirrored.Filled.List,
            title = "View Requests",
            onClick = onViewRequestsClick
        )
    }
}

// Helper functions to check if sections have content
private fun hasStructureFeatures(d: PropertyDescriptives): Boolean {
    return d.stories != null || d.lotSize != null || d.basement == true ||
            d.garage == true || d.attic == true || d.crawlSpace == true || d.fireplace == true
}

private fun hasHvacDetails(d: PropertyDescriptives): Boolean {
    return d.heatingSystem != null || d.heatingFuel != null || d.coolingSystem != null ||
            d.airConditioning == true || d.hvacAge != null || d.hvacBrand != null || d.thermostatType != null
}

private fun hasExteriorDetails(d: PropertyDescriptives): Boolean {
    return d.roofType != null || d.roofAge != null || d.exteriorMaterial != null ||
            d.foundationType != null || d.fence == true
}

private fun hasUtilitiesDetails(d: PropertyDescriptives): Boolean {
    return d.waterSource != null || d.sewerSystem != null || d.gasService == true ||
            d.electricalPanel != null || d.electricalAmps != null || d.waterHeater != null
}

private fun hasOutdoorFeatures(d: PropertyDescriptives): Boolean {
    return d.pool == true || d.patio == true || d.deck == true || d.sprinklerSystem == true
}
