package com.hestami_ai.myhomeagent.ui.screens.properties

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import com.hestami_ai.myhomeagent.ui.viewmodel.AddPropertyViewModel
import com.hestami_ai.myhomeagent.ui.viewmodel.propertyTypes
import com.hestami_ai.myhomeagent.ui.viewmodel.usStates

/**
 * Add property screen matching iOS AddPropertyView.swift.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddPropertyScreen(
    onNavigateBack: () -> Unit,
    onPropertyCreated: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: AddPropertyViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Handle success
    LaunchedEffect(uiState.isSuccess) {
        if (uiState.isSuccess) {
            onPropertyCreated()
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
                        text = "Add Property",
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
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 16.dp)
                .verticalScroll(rememberScrollState())
        ) {
            Spacer(modifier = Modifier.height(8.dp))

            // Basic Info Section
            SectionHeader("Basic Information")

            FormTextField(
                value = uiState.title,
                onValueChange = viewModel::updateTitle,
                label = "Property Title *",
                placeholder = "e.g., My Home"
            )

            FormTextField(
                value = uiState.description,
                onValueChange = viewModel::updateDescription,
                label = "Description",
                placeholder = "Describe your property",
                singleLine = false,
                minLines = 3
            )

            Spacer(modifier = Modifier.height(24.dp))

            // Address Section
            SectionHeader("Address")

            FormTextField(
                value = uiState.address,
                onValueChange = viewModel::updateAddress,
                label = "Street Address *",
                placeholder = "123 Main Street"
            )

            FormTextField(
                value = uiState.city,
                onValueChange = viewModel::updateCity,
                label = "City *",
                placeholder = "City"
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                DropdownField(
                    value = uiState.state,
                    onValueChange = viewModel::updateState,
                    label = "State *",
                    options = usStates,
                    modifier = Modifier.weight(1f)
                )

                FormTextField(
                    value = uiState.zipCode,
                    onValueChange = viewModel::updateZipCode,
                    label = "ZIP Code *",
                    placeholder = "12345",
                    keyboardType = KeyboardType.Number,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(modifier = Modifier.height(24.dp))

            // Property Details Section
            SectionHeader("Property Details (Optional)")

            DropdownField(
                value = uiState.propertyType,
                onValueChange = viewModel::updatePropertyType,
                label = "Property Type",
                options = propertyTypes
            )

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                FormTextField(
                    value = uiState.yearBuilt,
                    onValueChange = viewModel::updateYearBuilt,
                    label = "Year Built",
                    placeholder = "2000",
                    keyboardType = KeyboardType.Number,
                    modifier = Modifier.weight(1f)
                )

                FormTextField(
                    value = uiState.squareFootage,
                    onValueChange = viewModel::updateSquareFootage,
                    label = "Sq. Footage",
                    placeholder = "2000",
                    keyboardType = KeyboardType.Number,
                    modifier = Modifier.weight(1f)
                )
            }

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                FormTextField(
                    value = uiState.bedrooms,
                    onValueChange = viewModel::updateBedrooms,
                    label = "Bedrooms",
                    placeholder = "3",
                    keyboardType = KeyboardType.Number,
                    modifier = Modifier.weight(1f)
                )

                FormTextField(
                    value = uiState.bathrooms,
                    onValueChange = viewModel::updateBathrooms,
                    label = "Bathrooms",
                    placeholder = "2",
                    keyboardType = KeyboardType.Decimal,
                    modifier = Modifier.weight(1f)
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
                    containerColor = AppColors.SuccessColor,
                    contentColor = AppColors.PrimaryText,
                    disabledContainerColor = AppColors.DisabledText
                ),
                shape = RoundedCornerShape(12.dp)
            ) {
                if (uiState.isLoading) {
                    CircularProgressIndicator(
                        color = AppColors.PrimaryText,
                        modifier = Modifier.height(24.dp)
                    )
                } else {
                    Text(
                        text = "Add Property",
                        fontSize = 16.sp,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SectionHeader(title: String) {
    Text(
        text = title,
        fontSize = 18.sp,
        fontWeight = FontWeight.SemiBold,
        color = AppColors.PrimaryText,
        modifier = Modifier.padding(bottom = 12.dp)
    )
}

@Composable
private fun FormTextField(
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
            focusedBorderColor = AppColors.SuccessColor,
            unfocusedBorderColor = AppColors.BorderColor,
            focusedLabelColor = AppColors.SuccessColor,
            unfocusedLabelColor = AppColors.SecondaryText,
            cursorColor = AppColors.SuccessColor
        ),
        shape = RoundedCornerShape(12.dp),
        modifier = modifier
            .fillMaxWidth()
            .padding(bottom = 12.dp)
    )
}

@Composable
private fun DropdownField(
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
                focusedBorderColor = AppColors.SuccessColor,
                unfocusedBorderColor = AppColors.BorderColor,
                focusedLabelColor = AppColors.SuccessColor,
                unfocusedLabelColor = AppColors.SecondaryText
            ),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier
                .fillMaxWidth()
                .padding(bottom = 12.dp)
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
