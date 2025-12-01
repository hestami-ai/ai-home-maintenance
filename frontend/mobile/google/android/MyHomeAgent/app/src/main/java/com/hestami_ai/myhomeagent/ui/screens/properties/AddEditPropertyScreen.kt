package com.hestami_ai.myhomeagent.ui.screens.properties

import androidx.compose.animation.AnimatedVisibility
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import com.hestami_ai.myhomeagent.ui.viewmodel.AddEditPropertyViewModel
import com.hestami_ai.myhomeagent.ui.viewmodel.PropertyOptions

/**
 * Add/Edit property screen matching iOS AddEditPropertyView.swift.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddEditPropertyScreen(
    property: Property? = null,
    onNavigateBack: () -> Unit,
    onPropertySaved: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: AddEditPropertyViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }
    
    // Expanded sections state
    var expandedSections by remember { mutableStateOf(setOf("basic")) }

    // Load property data if editing
    LaunchedEffect(property) {
        property?.let { viewModel.loadProperty(it) }
    }

    // Handle success
    LaunchedEffect(uiState.isSuccess) {
        if (uiState.isSuccess) {
            onPropertySaved()
        }
    }

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
                        text = if (viewModel.isEditing) "Edit Property" else "Add Property",
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
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(16.dp)
            ) {
                // Basic Information Section (Always Expanded)
                ExpandableSection(
                    title = "Basic Information",
                    isExpanded = true,
                    onToggle = { /* Always expanded */ }
                ) {
                    PropertyFormTextField(
                        value = uiState.title,
                        onValueChange = viewModel::updateTitle,
                        label = "Property Name *",
                        placeholder = "Enter property name"
                    )
                    PropertyFormTextField(
                        value = uiState.address,
                        onValueChange = viewModel::updateAddress,
                        label = "Street Address *",
                        placeholder = "Enter street address"
                    )
                    PropertyFormTextField(
                        value = uiState.city,
                        onValueChange = viewModel::updateCity,
                        label = "City *",
                        placeholder = "Enter city"
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        PropertyDropdownField(
                            value = uiState.state,
                            onValueChange = viewModel::updateState,
                            label = "State *",
                            options = PropertyOptions.usStates,
                            modifier = Modifier.weight(1f)
                        )
                        PropertyFormTextField(
                            value = uiState.zipCode,
                            onValueChange = viewModel::updateZipCode,
                            label = "ZIP Code *",
                            placeholder = "12345",
                            keyboardType = KeyboardType.Number,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    PropertyFormTextField(
                        value = uiState.county,
                        onValueChange = viewModel::updateCounty,
                        label = "County",
                        placeholder = "Enter county (optional)"
                    )
                    PropertyDropdownField(
                        value = uiState.country,
                        onValueChange = viewModel::updateCountry,
                        label = "Country *",
                        options = PropertyOptions.countries
                    )
                    PropertyFormTextField(
                        value = uiState.description,
                        onValueChange = viewModel::updateDescription,
                        label = "Description",
                        placeholder = "Describe your property",
                        singleLine = false,
                        minLines = 3
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Property Details Section
                ExpandableSection(
                    title = "Property Details",
                    isExpanded = expandedSections.contains("details"),
                    onToggle = { toggleSection("details", expandedSections) { expandedSections = it } }
                ) {
                    PropertyDropdownField(
                        value = uiState.propertyType,
                        onValueChange = viewModel::updatePropertyType,
                        label = "Property Type",
                        options = PropertyOptions.propertyTypes
                    )
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        PropertyFormTextField(
                            value = uiState.squareFootage,
                            onValueChange = viewModel::updateSquareFootage,
                            label = "Square Footage",
                            placeholder = "2000",
                            keyboardType = KeyboardType.Number,
                            modifier = Modifier.weight(1f)
                        )
                        PropertyFormTextField(
                            value = uiState.lotSize,
                            onValueChange = viewModel::updateLotSize,
                            label = "Lot Size",
                            placeholder = "0.25 acres",
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        PropertyFormTextField(
                            value = uiState.stories,
                            onValueChange = viewModel::updateStories,
                            label = "Stories",
                            placeholder = "2",
                            keyboardType = KeyboardType.Number,
                            modifier = Modifier.weight(1f)
                        )
                        PropertyFormTextField(
                            value = uiState.yearBuilt,
                            onValueChange = viewModel::updateYearBuilt,
                            label = "Year Built",
                            placeholder = "2000",
                            keyboardType = KeyboardType.Number,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        PropertyFormTextField(
                            value = uiState.bedrooms,
                            onValueChange = viewModel::updateBedrooms,
                            label = "Bedrooms",
                            placeholder = "3",
                            keyboardType = KeyboardType.Number,
                            modifier = Modifier.weight(1f)
                        )
                        PropertyFormTextField(
                            value = uiState.bathrooms,
                            onValueChange = viewModel::updateBathrooms,
                            label = "Bathrooms",
                            placeholder = "2.5",
                            keyboardType = KeyboardType.Decimal,
                            modifier = Modifier.weight(1f)
                        )
                    }
                    PropertyFormTextField(
                        value = uiState.unitNumber,
                        onValueChange = viewModel::updateUnitNumber,
                        label = "Unit Number",
                        placeholder = "Apt/Unit # (if applicable)"
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Structure & Features Section
                ExpandableSection(
                    title = "Structure & Features",
                    isExpanded = expandedSections.contains("structure"),
                    onToggle = { toggleSection("structure", expandedSections) { expandedSections = it } }
                ) {
                    PropertyToggleField(
                        label = "Basement",
                        checked = uiState.basement,
                        onCheckedChange = viewModel::updateBasement
                    )
                    if (uiState.basement) {
                        PropertyDropdownField(
                            value = uiState.basementType,
                            onValueChange = viewModel::updateBasementType,
                            label = "Basement Type",
                            options = PropertyOptions.basementTypes
                        )
                    }
                    PropertyToggleField(
                        label = "Garage",
                        checked = uiState.garage,
                        onCheckedChange = viewModel::updateGarage
                    )
                    if (uiState.garage) {
                        PropertyDropdownField(
                            value = uiState.garageType,
                            onValueChange = viewModel::updateGarageType,
                            label = "Garage Type",
                            options = PropertyOptions.garageTypes
                        )
                        PropertyFormTextField(
                            value = uiState.garageSpaces,
                            onValueChange = viewModel::updateGarageSpaces,
                            label = "Garage Spaces",
                            placeholder = "2",
                            keyboardType = KeyboardType.Number
                        )
                    }
                    PropertyToggleField(
                        label = "Attic",
                        checked = uiState.attic,
                        onCheckedChange = viewModel::updateAttic
                    )
                    if (uiState.attic) {
                        PropertyDropdownField(
                            value = uiState.atticAccess,
                            onValueChange = viewModel::updateAtticAccess,
                            label = "Attic Access",
                            options = PropertyOptions.atticAccessTypes
                        )
                    }
                    PropertyToggleField(
                        label = "Crawl Space",
                        checked = uiState.crawlSpace,
                        onCheckedChange = viewModel::updateCrawlSpace
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // HVAC Section
                ExpandableSection(
                    title = "HVAC & Climate",
                    isExpanded = expandedSections.contains("hvac"),
                    onToggle = { toggleSection("hvac", expandedSections) { expandedSections = it } }
                ) {
                    PropertyDropdownField(
                        value = uiState.heatingSystem,
                        onValueChange = viewModel::updateHeatingSystem,
                        label = "Heating System",
                        options = PropertyOptions.heatingSystems
                    )
                    if (uiState.heatingSystem != "None") {
                        PropertyDropdownField(
                            value = uiState.heatingFuel,
                            onValueChange = viewModel::updateHeatingFuel,
                            label = "Heating Fuel",
                            options = PropertyOptions.heatingFuels
                        )
                    }
                    PropertyDropdownField(
                        value = uiState.coolingSystem,
                        onValueChange = viewModel::updateCoolingSystem,
                        label = "Cooling System",
                        options = PropertyOptions.coolingSystems
                    )
                    PropertyToggleField(
                        label = "Air Conditioning",
                        checked = uiState.airConditioning,
                        onCheckedChange = viewModel::updateAirConditioning
                    )
                    PropertyFormTextField(
                        value = uiState.hvacAge,
                        onValueChange = viewModel::updateHvacAge,
                        label = "HVAC Age (years)",
                        placeholder = "10",
                        keyboardType = KeyboardType.Number
                    )
                    PropertyDropdownField(
                        value = uiState.thermostatType,
                        onValueChange = viewModel::updateThermostatType,
                        label = "Thermostat Type",
                        options = PropertyOptions.thermostatTypes
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Exterior Section
                ExpandableSection(
                    title = "Exterior & Roofing",
                    isExpanded = expandedSections.contains("exterior"),
                    onToggle = { toggleSection("exterior", expandedSections) { expandedSections = it } }
                ) {
                    PropertyDropdownField(
                        value = uiState.roofType,
                        onValueChange = viewModel::updateRoofType,
                        label = "Roof Type",
                        options = PropertyOptions.roofTypes
                    )
                    PropertyFormTextField(
                        value = uiState.roofAge,
                        onValueChange = viewModel::updateRoofAge,
                        label = "Roof Age",
                        placeholder = "Age in years or 'Unknown'"
                    )
                    PropertyDropdownField(
                        value = uiState.exteriorMaterial,
                        onValueChange = viewModel::updateExteriorMaterial,
                        label = "Exterior Material",
                        options = PropertyOptions.exteriorMaterials
                    )
                    PropertyDropdownField(
                        value = uiState.foundationType,
                        onValueChange = viewModel::updateFoundationType,
                        label = "Foundation Type",
                        options = PropertyOptions.foundationTypes
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Access & Security Section
                ExpandableSection(
                    title = "Access & Security",
                    isExpanded = expandedSections.contains("access"),
                    onToggle = { toggleSection("access", expandedSections) { expandedSections = it } }
                ) {
                    PropertyToggleField(
                        label = "Gated Community",
                        checked = uiState.gatedCommunity,
                        onCheckedChange = viewModel::updateGatedCommunity
                    )
                    PropertyFormTextField(
                        value = uiState.accessCode,
                        onValueChange = viewModel::updateAccessCode,
                        label = "Access Code",
                        placeholder = "Gate/door code"
                    )
                    PropertyFormTextField(
                        value = uiState.accessInstructions,
                        onValueChange = viewModel::updateAccessInstructions,
                        label = "Access Instructions",
                        placeholder = "Special access instructions"
                    )
                    PropertyDropdownField(
                        value = uiState.parkingType,
                        onValueChange = viewModel::updateParkingType,
                        label = "Parking Type",
                        options = PropertyOptions.parkingTypes
                    )
                    PropertyFormTextField(
                        value = uiState.parkingSpaces,
                        onValueChange = viewModel::updateParkingSpaces,
                        label = "Parking Spaces",
                        placeholder = "2",
                        keyboardType = KeyboardType.Number
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Landscaping Section
                ExpandableSection(
                    title = "Landscaping & Outdoor",
                    isExpanded = expandedSections.contains("landscaping"),
                    onToggle = { toggleSection("landscaping", expandedSections) { expandedSections = it } }
                ) {
                    PropertyToggleField(
                        label = "Sprinkler System",
                        checked = uiState.sprinklerSystem,
                        onCheckedChange = viewModel::updateSprinklerSystem
                    )
                    PropertyToggleField(
                        label = "Pool",
                        checked = uiState.pool,
                        onCheckedChange = viewModel::updatePool
                    )
                    if (uiState.pool) {
                        PropertyDropdownField(
                            value = uiState.poolType,
                            onValueChange = viewModel::updatePoolType,
                            label = "Pool Type",
                            options = PropertyOptions.poolTypes
                        )
                    }
                    PropertyToggleField(
                        label = "Fence",
                        checked = uiState.fence,
                        onCheckedChange = viewModel::updateFence
                    )
                    if (uiState.fence) {
                        PropertyDropdownField(
                            value = uiState.fenceType,
                            onValueChange = viewModel::updateFenceType,
                            label = "Fence Type",
                            options = PropertyOptions.fenceTypes
                        )
                    }
                    PropertyToggleField(
                        label = "Deck",
                        checked = uiState.deck,
                        onCheckedChange = viewModel::updateDeck
                    )
                    if (uiState.deck) {
                        PropertyDropdownField(
                            value = uiState.deckMaterial,
                            onValueChange = viewModel::updateDeckMaterial,
                            label = "Deck Material",
                            options = PropertyOptions.deckMaterials
                        )
                    }
                    PropertyToggleField(
                        label = "Patio",
                        checked = uiState.patio,
                        onCheckedChange = viewModel::updatePatio
                    )
                    if (uiState.patio) {
                        PropertyDropdownField(
                            value = uiState.patioMaterial,
                            onValueChange = viewModel::updatePatioMaterial,
                            label = "Patio Material",
                            options = PropertyOptions.patioMaterials
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Special Considerations Section
                ExpandableSection(
                    title = "Special Considerations",
                    isExpanded = expandedSections.contains("special"),
                    onToggle = { toggleSection("special", expandedSections) { expandedSections = it } }
                ) {
                    PropertyToggleField(
                        label = "Pet Friendly",
                        checked = uiState.petFriendly,
                        onCheckedChange = viewModel::updatePetFriendly
                    )
                    PropertyToggleField(
                        label = "Smoking Allowed",
                        checked = uiState.smokingAllowed,
                        onCheckedChange = viewModel::updateSmokingAllowed
                    )
                    PropertyToggleField(
                        label = "Wheelchair Accessible",
                        checked = uiState.wheelchairAccessible,
                        onCheckedChange = viewModel::updateWheelchairAccessible
                    )
                    PropertyToggleField(
                        label = "Fireplace",
                        checked = uiState.fireplace,
                        onCheckedChange = viewModel::updateFireplace
                    )
                    if (uiState.fireplace) {
                        PropertyDropdownField(
                            value = uiState.fireplaceType,
                            onValueChange = viewModel::updateFireplaceType,
                            label = "Fireplace Type",
                            options = PropertyOptions.fireplaceTypes
                        )
                    }
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Notes Section
                ExpandableSection(
                    title = "Maintenance & Notes",
                    isExpanded = expandedSections.contains("notes"),
                    onToggle = { toggleSection("notes", expandedSections) { expandedSections = it } }
                ) {
                    PropertyFormTextField(
                        value = uiState.maintenanceNotes,
                        onValueChange = viewModel::updateMaintenanceNotes,
                        label = "Maintenance Notes",
                        placeholder = "Notes about maintenance",
                        singleLine = false,
                        minLines = 3
                    )
                    PropertyFormTextField(
                        value = uiState.specialInstructions,
                        onValueChange = viewModel::updateSpecialInstructions,
                        label = "Special Instructions",
                        placeholder = "Any special instructions",
                        singleLine = false,
                        minLines = 3
                    )
                }

                Spacer(modifier = Modifier.height(32.dp))

                // Submit Button
                Button(
                    onClick = viewModel::submitProperty,
                    enabled = !uiState.isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppColors.AccentPrimary,
                        contentColor = AppColors.PrimaryText,
                        disabledContainerColor = AppColors.DisabledText
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    if (uiState.isLoading) {
                        CircularProgressIndicator(
                            color = AppColors.PrimaryText,
                            modifier = Modifier.size(24.dp)
                        )
                    } else {
                        Text(
                            text = if (viewModel.isEditing) "Update Property" else "Add Property",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
            
            // Loading overlay
            if (uiState.isLoading) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(AppColors.PrimaryBackground.copy(alpha = 0.7f)),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = AppColors.AccentPrimary)
                }
            }
        }
    }
}

private fun toggleSection(section: String, current: Set<String>, update: (Set<String>) -> Unit) {
    update(if (current.contains(section)) current - section else current + section)
}

@Composable
private fun ExpandableSection(
    title: String,
    isExpanded: Boolean,
    onToggle: () -> Unit,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = AppColors.CardBackground),
        shape = RoundedCornerShape(12.dp)
    ) {
        Column {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable(onClick = onToggle)
                    .padding(16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    fontSize = 16.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = AppColors.PrimaryText
                )
                Icon(
                    imageVector = if (isExpanded) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
                    contentDescription = if (isExpanded) "Collapse" else "Expand",
                    tint = AppColors.SecondaryText
                )
            }
            
            AnimatedVisibility(visible = isExpanded) {
                Column(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp)
                        .padding(bottom = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    content()
                }
            }
        }
    }
}

@Composable
private fun PropertyFormTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    placeholder: String,
    modifier: Modifier = Modifier,
    singleLine: Boolean = true,
    minLines: Int = 1,
    keyboardType: KeyboardType = KeyboardType.Text
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        placeholder = { Text(placeholder, color = AppColors.DisabledText) },
        singleLine = singleLine,
        minLines = minLines,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        colors = OutlinedTextFieldDefaults.colors(
            focusedTextColor = AppColors.PrimaryText,
            unfocusedTextColor = AppColors.PrimaryText,
            focusedBorderColor = AppColors.AccentPrimary,
            unfocusedBorderColor = AppColors.BorderColor,
            focusedLabelColor = AppColors.AccentPrimary,
            unfocusedLabelColor = AppColors.SecondaryText,
            cursorColor = AppColors.AccentPrimary
        ),
        shape = RoundedCornerShape(10.dp),
        modifier = modifier.fillMaxWidth()
    )
}

@Composable
private fun PropertyDropdownField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    options: List<String>,
    modifier: Modifier = Modifier
) {
    var expanded by remember { mutableStateOf(false) }

    Column(modifier = modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            label = { Text(label) },
            readOnly = true,
            trailingIcon = {
                IconButton(onClick = { expanded = true }) {
                    Icon(
                        imageVector = Icons.Filled.KeyboardArrowDown,
                        contentDescription = "Select",
                        tint = AppColors.SecondaryText
                    )
                }
            },
            colors = OutlinedTextFieldDefaults.colors(
                focusedTextColor = AppColors.PrimaryText,
                unfocusedTextColor = AppColors.PrimaryText,
                focusedBorderColor = AppColors.AccentPrimary,
                unfocusedBorderColor = AppColors.BorderColor,
                focusedLabelColor = AppColors.AccentPrimary,
                unfocusedLabelColor = AppColors.SecondaryText
            ),
            shape = RoundedCornerShape(10.dp),
            modifier = Modifier.fillMaxWidth()
        )

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false }
        ) {
            options.forEach { option ->
                DropdownMenuItem(
                    text = { Text(option) },
                    onClick = {
                        onValueChange(option)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
private fun PropertyToggleField(
    label: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.CardBackground, RoundedCornerShape(10.dp))
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = label,
            fontSize = 14.sp,
            fontWeight = FontWeight.Medium,
            color = AppColors.PrimaryText
        )
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            colors = SwitchDefaults.colors(
                checkedThumbColor = AppColors.PrimaryText,
                checkedTrackColor = AppColors.AccentPrimary,
                uncheckedThumbColor = AppColors.SecondaryText,
                uncheckedTrackColor = AppColors.BorderColor
            )
        )
    }
}
