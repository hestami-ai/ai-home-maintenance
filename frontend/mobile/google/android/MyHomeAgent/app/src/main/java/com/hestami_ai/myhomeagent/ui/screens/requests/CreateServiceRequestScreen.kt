package com.hestami_ai.myhomeagent.ui.screens.requests

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.CalendarToday
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.Schedule
import androidx.compose.material.icons.outlined.Cottage
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MenuAnchorType
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Snackbar
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.TimePickerState
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.derivedStateOf
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import com.hestami_ai.myhomeagent.ui.viewmodel.CreateServiceRequestUiState
import com.hestami_ai.myhomeagent.ui.viewmodel.CreateServiceRequestViewModel
import com.hestami_ai.myhomeagent.ui.viewmodel.TimeSlotInput
import com.hestami_ai.myhomeagent.ui.viewmodel.priorityLevels
import com.hestami_ai.myhomeagent.ui.viewmodel.serviceCategories
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Calendar

/**
 * Create service request screen matching iOS CreateServiceRequestView.swift.
 * Refactored to use Card-based sections.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateServiceRequestScreen(
    onNavigateBack: () -> Unit,
    onRequestCreated: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: CreateServiceRequestViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    val snackbarHostState = remember { SnackbarHostState() }

    // Handle success
    LaunchedEffect(uiState.isSuccess) {
        if (uiState.isSuccess) {
            onRequestCreated()
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
                        text = "New Service Request",
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
        if (uiState.isLoadingProperties) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator(color = AppColors.SuccessColor)
            }
        } else {
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding)
                    .padding(horizontal = 16.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(20.dp)
            ) {
                Spacer(modifier = Modifier.height(8.dp))

                // 1. Property Selection
                ContentCard(title = "Property") {
                    if (uiState.properties.isEmpty()) {
                        Text(
                            text = "No properties available",
                            color = AppColors.SecondaryText,
                            fontSize = 14.sp
                        )
                    } else {
                        PropertySelector(
                            properties = uiState.properties,
                            selectedProperty = uiState.selectedProperty,
                            onPropertySelected = viewModel::selectProperty
                        )
                    }
                }

                // 2. Title
                ContentCard(title = "Title") {
                    TransparentTextField(
                        value = uiState.title,
                        onValueChange = viewModel::updateTitle,
                        placeholder = "Enter a brief title"
                    )
                }

                // 3. Description
                ContentCard(title = "Description") {
                    TransparentTextField(
                        value = uiState.description,
                        onValueChange = viewModel::updateDescription,
                        placeholder = "Describe the issue...",
                        minLines = 4,
                        singleLine = false
                    )
                }

                // 4. Category
                ContentCard(title = "Category") {
                    CategoryDropdown(
                        selectedCategory = uiState.category,
                        onCategorySelected = viewModel::updateCategory
                    )
                }

                // 5. Priority
                ContentCard(title = "Priority") {
                    PriorityDropdown(
                        selectedPriority = uiState.priority,
                        onPrioritySelected = viewModel::updatePriority
                    )
                }

                // 6. Schedule Service
                ContentCard(title = null) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Schedule Service",
                                fontWeight = FontWeight.Bold,
                                color = AppColors.PrimaryText,
                                fontSize = 16.sp
                            )
                            Switch(
                                checked = uiState.useSchedule,
                                onCheckedChange = viewModel::updateUseSchedule,
                                colors = SwitchDefaults.colors(
                                    checkedThumbColor = AppColors.PrimaryText,
                                    checkedTrackColor = AppColors.SuccessColor,
                                    uncheckedThumbColor = AppColors.SecondaryText,
                                    uncheckedTrackColor = AppColors.BorderColor
                                )
                            )
                        }
                        
                        if (uiState.useSchedule) {
                            Spacer(modifier = Modifier.height(16.dp))
                            SchedulePickers(
                                start = uiState.scheduledStart,
                                startTime = uiState.scheduledStartTime,
                                end = uiState.scheduledEnd,
                                endTime = uiState.scheduledEndTime,
                                onStartChange = viewModel::updateScheduledStart,
                                onStartTimeChange = viewModel::updateScheduledStartTime,
                                onEndChange = viewModel::updateScheduledEnd,
                                onEndTimeChange = viewModel::updateScheduledEndTime
                            )
                        }
                    }
                }

                // 7. Preferred Schedule
                ContentCard(title = "Preferred Schedule") {
                    PreferredScheduleSection(
                        uiState = uiState,
                        onAddSlot = viewModel::addTimeSlot,
                        onRemoveSlot = viewModel::removeTimeSlot,
                        onFlexibleChange = viewModel::updateIsFlexible,
                        onNotesChange = viewModel::updateScheduleNotes
                    )
                }
                
                // 8. Media
                ContentCard(title = "Attach Media (Optional)") {
                    MediaSection(
                        mediaUris = uiState.mediaUris,
                        onAddMedia = viewModel::addMedia,
                        onRemoveMedia = viewModel::removeMedia
                    )
                }

                // DIY Toggle (Optional, sticking to iOS parity mostly but this existed before)
                ContentCard(title = null) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column {
                            Text(
                                text = "DIY Project",
                                fontWeight = FontWeight.Bold,
                                color = AppColors.PrimaryText,
                                fontSize = 16.sp
                            )
                            Text(
                                text = "I plan to fix this myself",
                                fontSize = 14.sp,
                                color = AppColors.SecondaryText
                            )
                        }
                        Switch(
                            checked = uiState.isDiy,
                            onCheckedChange = viewModel::updateIsDiy,
                            colors = SwitchDefaults.colors(
                                checkedThumbColor = AppColors.PrimaryText,
                                checkedTrackColor = AppColors.SuccessColor,
                                uncheckedThumbColor = AppColors.SecondaryText,
                                uncheckedTrackColor = AppColors.BorderColor
                            )
                        )
                    }
                }

                Spacer(modifier = Modifier.height(12.dp))

                // Submit Button
                Button(
                    onClick = viewModel::submitRequest,
                    enabled = !uiState.isSubmitting,
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
                    if (uiState.isSubmitting) {
                        CircularProgressIndicator(
                            color = AppColors.PrimaryText,
                            modifier = Modifier.size(24.dp)
                        )
                    } else {
                        Text(
                            text = "Create Service Request",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))
            }
        }
    }
}

// MARK: - Components

@Composable
fun ContentCard(
    title: String?,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(
            containerColor = AppColors.CardBackground
        ),
        shape = RoundedCornerShape(12.dp),
        border = BorderStroke(1.dp, AppColors.BorderColor)
    ) {
        Column(
            modifier = Modifier.padding(16.dp)
        ) {
            if (title != null) {
                Text(
                    text = title,
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    color = AppColors.PrimaryText
                )
                Spacer(modifier = Modifier.height(12.dp))
            }
            content()
        }
    }
}

@Composable
fun TransparentTextField(
    value: String,
    onValueChange: (String) -> Unit,
    placeholder: String,
    minLines: Int = 1,
    singleLine: Boolean = true
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        placeholder = { Text(placeholder, color = AppColors.DisabledText) },
        modifier = Modifier.fillMaxWidth(),
        minLines = minLines,
        singleLine = singleLine,
        colors = OutlinedTextFieldDefaults.colors(
            focusedBorderColor = Color.Transparent,
            unfocusedBorderColor = Color.Transparent,
            focusedContainerColor = AppColors.SecondaryBackground,
            unfocusedContainerColor = AppColors.SecondaryBackground,
            focusedTextColor = AppColors.PrimaryText,
            unfocusedTextColor = AppColors.PrimaryText
        ),
        shape = RoundedCornerShape(8.dp)
    )
}

@Composable
fun PropertySelector(
    properties: List<Property>,
    selectedProperty: Property?,
    onPropertySelected: (Property) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    Box(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(AppColors.SecondaryBackground, RoundedCornerShape(8.dp))
                .clickable { expanded = true }
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = selectedProperty?.title ?: "Select Property",
                color = if (selectedProperty == null) AppColors.SecondaryText else AppColors.PrimaryText
            )
            Icon(
                imageVector = Icons.Default.KeyboardArrowDown,
                contentDescription = null,
                tint = AppColors.SecondaryText
            )
        }

        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(AppColors.CardBackground)
        ) {
            properties.forEach { property ->
                DropdownMenuItem(
                    text = { Text(property.title, color = AppColors.PrimaryText) },
                    onClick = {
                        onPropertySelected(property)
                        expanded = false
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryDropdown(
    selectedCategory: String,
    onCategorySelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        OutlinedTextField(
            value = selectedCategory.replace("_", " "),
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color.Transparent,
                unfocusedBorderColor = Color.Transparent,
                focusedContainerColor = AppColors.SecondaryBackground,
                unfocusedContainerColor = AppColors.SecondaryBackground,
                focusedTextColor = AppColors.PrimaryText,
                unfocusedTextColor = AppColors.PrimaryText
            ),
            shape = RoundedCornerShape(8.dp)
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(AppColors.CardBackground)
        ) {
            serviceCategories.forEach { category ->
                DropdownMenuItem(
                    text = { Text(category.replace("_", " "), color = AppColors.PrimaryText) },
                    onClick = {
                        onCategorySelected(category)
                        expanded = false
                    }
                )
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PriorityDropdown(
    selectedPriority: String,
    onPrioritySelected: (String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }

    ExposedDropdownMenuBox(
        expanded = expanded,
        onExpandedChange = { expanded = !expanded }
    ) {
        val color = when (selectedPriority) {
            "URGENT" -> AppColors.ErrorColor
            "HIGH" -> AppColors.WarningColor
            "MEDIUM" -> AppColors.InfoColor
            else -> AppColors.PrimaryText
        }

        OutlinedTextField(
            value = selectedPriority,
            onValueChange = {},
            readOnly = true,
            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
            modifier = Modifier
                .fillMaxWidth()
                .menuAnchor(MenuAnchorType.PrimaryNotEditable, enabled = true),
            colors = OutlinedTextFieldDefaults.colors(
                focusedBorderColor = Color.Transparent,
                unfocusedBorderColor = Color.Transparent,
                focusedContainerColor = AppColors.SecondaryBackground,
                unfocusedContainerColor = AppColors.SecondaryBackground,
                focusedTextColor = color,
                unfocusedTextColor = color
            ),
            shape = RoundedCornerShape(8.dp)
        )

        ExposedDropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.background(AppColors.CardBackground)
        ) {
            priorityLevels.forEach { priority ->
                DropdownMenuItem(
                    text = { Text(priority, color = AppColors.PrimaryText) },
                    onClick = {
                        onPrioritySelected(priority)
                        expanded = false
                    }
                )
            }
        }
    }
}

@Composable
fun SchedulePickers(
    start: LocalDate,
    startTime: LocalTime,
    end: LocalDate,
    endTime: LocalTime,
    onStartChange: (LocalDate) -> Unit,
    onStartTimeChange: (LocalTime) -> Unit,
    onEndChange: (LocalDate) -> Unit,
    onEndTimeChange: (LocalTime) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("Start Date", fontSize = 12.sp, color = AppColors.SecondaryText)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DatePickerButton(date = start, onDateSelected = onStartChange, modifier = Modifier.weight(1f))
            TimePickerButton(time = startTime, onTimeSelected = onStartTimeChange, modifier = Modifier.weight(1f))
        }
        
        Text("End Date", fontSize = 12.sp, color = AppColors.SecondaryText)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DatePickerButton(date = end, onDateSelected = onEndChange, modifier = Modifier.weight(1f))
            TimePickerButton(time = endTime, onTimeSelected = onEndTimeChange, modifier = Modifier.weight(1f))
        }
    }
}

@Composable
fun PreferredScheduleSection(
    uiState: CreateServiceRequestUiState,
    onAddSlot: (LocalDate, LocalTime, LocalTime) -> Unit,
    onRemoveSlot: (String) -> Unit,
    onFlexibleChange: (Boolean) -> Unit,
    onNotesChange: (String) -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text(
            "Add your available dates and times for service visits",
            fontSize = 14.sp,
            color = AppColors.SecondaryText
        )
        
        // List of Slots
        uiState.timeSlots.forEach { slot ->
            TimeSlotRow(slot = slot, onRemove = { onRemoveSlot(slot.id) })
        }
        
        // Add Button
        // We need a temporary state for the 'Add' dialog/interaction
        // For simplicity, we'll just show a button that adds a default slot or opens a dialog.
        // Let's open a simple dialog or expanded area.
        var showAddDialog by remember { mutableStateOf(false) }
        if (showAddDialog) {
            AddTimeSlotDialog(
                onDismiss = { showAddDialog = false },
                onAdd = { d, s, e -> 
                    onAddSlot(d, s, e)
                    showAddDialog = false
                }
            )
        }
        
        Button(
            onClick = { showAddDialog = true },
            colors = ButtonDefaults.buttonColors(
                containerColor = AppColors.SecondaryBackground,
                contentColor = AppColors.SuccessColor
            ),
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.AddCircle, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("Add Available Time")
        }
        
        HorizontalDivider(color = AppColors.BorderColor)
        
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text("I'm flexible with timing", color = AppColors.PrimaryText)
            Switch(
                checked = uiState.isFlexible,
                onCheckedChange = onFlexibleChange,
                colors = SwitchDefaults.colors(
                    checkedThumbColor = AppColors.PrimaryText,
                    checkedTrackColor = AppColors.SuccessColor
                )
            )
        }
        
        if (uiState.isFlexible || uiState.timeSlots.isNotEmpty()) {
            TransparentTextField(
                value = uiState.scheduleNotes,
                onValueChange = onNotesChange,
                placeholder = "Additional Notes (e.g. Prefer mornings)"
            )
        }
    }
}

@Composable
fun TimeSlotRow(slot: TimeSlotInput, onRemove: () -> Unit) {
    val dateFormatter = DateTimeFormatter.ofPattern("MMM dd, yyyy")
    val timeFormatter = DateTimeFormatter.ofPattern("h:mm a")
    
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(AppColors.SecondaryBackground, RoundedCornerShape(8.dp))
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Row {
                Icon(Icons.Default.CalendarToday, contentDescription = null, tint = AppColors.SuccessColor, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text(slot.date.format(dateFormatter), fontWeight = FontWeight.Medium, color = AppColors.PrimaryText)
            }
            Spacer(Modifier.height(4.dp))
            Row {
                Icon(Icons.Default.Schedule, contentDescription = null, tint = AppColors.SecondaryText, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(8.dp))
                Text(
                    "${slot.startTime.format(timeFormatter)} - ${slot.endTime.format(timeFormatter)}",
                    color = AppColors.SecondaryText,
                    fontSize = 14.sp
                )
            }
        }
        IconButton(onClick = onRemove) {
            Icon(Icons.Default.Delete, contentDescription = "Remove", tint = AppColors.ErrorColor)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddTimeSlotDialog(
    onDismiss: () -> Unit,
    onAdd: (LocalDate, LocalTime, LocalTime) -> Unit
) {
    // Simple inline inputs instead of full dialog to keep context
    var date by remember { mutableStateOf(LocalDate.now().plusDays(1)) }
    var start by remember { mutableStateOf(LocalTime.of(9, 0)) }
    var end by remember { mutableStateOf(LocalTime.of(12, 0)) }
    
    Card(
        colors = CardDefaults.cardColors(containerColor = AppColors.PrimaryBackground),
        border = BorderStroke(1.dp, AppColors.BorderColor),
        modifier = Modifier.padding(vertical = 8.dp)
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("New Time Slot", fontWeight = FontWeight.Bold)
            DatePickerButton(date = date, onDateSelected = { date = it })
            Row {
                TimePickerButton(time = start, onTimeSelected = { start = it }, modifier = Modifier.weight(1f))
                Spacer(Modifier.width(8.dp))
                TimePickerButton(time = end, onTimeSelected = { end = it }, modifier = Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.End, modifier = Modifier.fillMaxWidth()) {
                TextButton(onClick = onDismiss) { Text("Cancel", color = AppColors.SecondaryText) }
                TextButton(onClick = { onAdd(date, start, end) }) { Text("Add", color = AppColors.SuccessColor) }
            }
        }
    }
}

@Composable
fun MediaSection(
    mediaUris: List<Uri>,
    onAddMedia: (List<Uri>) -> Unit,
    onRemoveMedia: (Uri) -> Unit
) {
    val launcher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.PickMultipleVisualMedia(maxItems = 10)
    ) { uris ->
        if (uris.isNotEmpty()) {
            onAddMedia(uris)
        }
    }
    
    Column {
        Button(
            onClick = { 
                launcher.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo))
            },
            colors = ButtonDefaults.buttonColors(containerColor = AppColors.SecondaryBackground),
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.Image, contentDescription = null, tint = AppColors.PrimaryText)
            Spacer(Modifier.width(8.dp))
            Text("Select Media", color = AppColors.PrimaryText)
        }
        
        if (mediaUris.isNotEmpty()) {
            Spacer(Modifier.height(12.dp))
            LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                items(mediaUris) { uri ->
                    Box {
                        AsyncImage(
                            model = uri,
                            contentDescription = null,
                            modifier = Modifier
                                .size(80.dp)
                                .clip(RoundedCornerShape(8.dp)),
                            contentScale = ContentScale.Crop
                        )
                        IconButton(
                            onClick = { onRemoveMedia(uri) },
                            modifier = Modifier
                                .align(Alignment.TopEnd)
                                .size(24.dp)
                                .background(Color.Black.copy(alpha = 0.5f), CircleShape)
                        ) {
                            Icon(Icons.Default.Close, contentDescription = null, tint = Color.White, modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DatePickerButton(
    date: LocalDate,
    onDateSelected: (LocalDate) -> Unit,
    modifier: Modifier = Modifier
) {
    var showDialog by remember { mutableStateOf(false) }
    val dateFormatter = DateTimeFormatter.ofPattern("MMM dd, yyyy")
    
    if (showDialog) {
        val datePickerState = rememberDatePickerState(
            initialSelectedDateMillis = date.atStartOfDay(ZoneId.systemDefault()).toInstant().toEpochMilli()
        )
        
        DatePickerDialog(
            onDismissRequest = { showDialog = false },
            confirmButton = {
                TextButton(onClick = {
                    datePickerState.selectedDateMillis?.let { millis ->
                        onDateSelected(Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()).toLocalDate())
                    }
                    showDialog = false
                }) {
                    Text("OK", color = AppColors.SuccessColor)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDialog = false }) {
                    Text("Cancel", color = AppColors.SecondaryText)
                }
            }
        ) {
            DatePicker(state = datePickerState)
        }
    }
    
    Button(
        onClick = { showDialog = true },
        colors = ButtonDefaults.buttonColors(containerColor = AppColors.SecondaryBackground),
        modifier = modifier
    ) {
        Text(date.format(dateFormatter), color = AppColors.PrimaryText)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TimePickerButton(
    time: LocalTime,
    onTimeSelected: (LocalTime) -> Unit,
    modifier: Modifier = Modifier
) {
    var showDialog by remember { mutableStateOf(false) }
    val timeFormatter = DateTimeFormatter.ofPattern("h:mm a")
    
    if (showDialog) {
        val timePickerState = rememberTimePickerState(
            initialHour = time.hour,
            initialMinute = time.minute
        )
        
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showDialog = false },
            confirmButton = {
                TextButton(onClick = {
                    onTimeSelected(LocalTime.of(timePickerState.hour, timePickerState.minute))
                    showDialog = false
                }) {
                    Text("OK", color = AppColors.SuccessColor)
                }
            },
            dismissButton = {
                TextButton(onClick = { showDialog = false }) {
                    Text("Cancel", color = AppColors.SecondaryText)
                }
            },
            text = {
                TimePicker(state = timePickerState)
            }
        )
    }
    
    Button(
        onClick = { showDialog = true },
        colors = ButtonDefaults.buttonColors(containerColor = AppColors.SecondaryBackground),
        modifier = modifier
    ) {
        Text(time.format(timeFormatter), color = AppColors.PrimaryText)
    }
}
