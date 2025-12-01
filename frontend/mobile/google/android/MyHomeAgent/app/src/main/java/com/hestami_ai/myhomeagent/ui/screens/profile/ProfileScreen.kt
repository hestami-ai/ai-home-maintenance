package com.hestami_ai.myhomeagent.ui.screens.profile

import androidx.compose.foundation.background
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
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.automirrored.filled.Logout
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material.icons.filled.Work
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import com.hestami_ai.myhomeagent.ui.viewmodel.ProfileViewModel

/**
 * Profile screen showing user account information.
 * Allows viewing profile details, changing password, and signing out.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    onNavigateBack: () -> Unit,
    onLogout: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: ProfileViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()
    var showChangePasswordDialog by remember { mutableStateOf(false) }
    var showLogoutConfirmDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        viewModel.loadProfile()
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Profile",
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
                .padding(16.dp)
        ) {
            if (uiState.isLoading) {
                Box(
                    modifier = Modifier.fillMaxSize(),
                    contentAlignment = Alignment.Center
                ) {
                    CircularProgressIndicator(color = AppColors.SuccessColor)
                }
            } else {
                // Profile Avatar
                Box(
                    modifier = Modifier
                        .align(Alignment.CenterHorizontally)
                        .size(100.dp)
                        .clip(CircleShape)
                        .background(AppColors.SuccessColor),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = uiState.user?.initials ?: "?",
                        fontSize = 36.sp,
                        fontWeight = FontWeight.Bold,
                        color = AppColors.PrimaryText
                    )
                }

                Spacer(modifier = Modifier.height(16.dp))

                // Display Name
                Text(
                    text = uiState.user?.displayName ?: "User",
                    fontSize = 24.sp,
                    fontWeight = FontWeight.Bold,
                    color = AppColors.PrimaryText,
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )

                Text(
                    text = uiState.user?.userRole?.replace("_", " ")?.lowercase()
                        ?.replaceFirstChar { it.uppercase() } ?: "",
                    fontSize = 14.sp,
                    color = AppColors.SecondaryText,
                    modifier = Modifier.align(Alignment.CenterHorizontally)
                )

                Spacer(modifier = Modifier.height(32.dp))

                // Account Information Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = AppColors.CardBackground
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Account Information",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = AppColors.PrimaryText
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        ProfileInfoRow(
                            icon = Icons.Filled.Person,
                            label = "Name",
                            value = uiState.user?.displayName ?: "Not set"
                        )

                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 12.dp),
                            color = AppColors.BorderColor
                        )

                        ProfileInfoRow(
                            icon = Icons.Filled.Email,
                            label = "Email",
                            value = uiState.user?.email ?: "Not set"
                        )

                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 12.dp),
                            color = AppColors.BorderColor
                        )

                        ProfileInfoRow(
                            icon = Icons.Filled.Phone,
                            label = "Phone",
                            value = uiState.user?.phoneNumber ?: "Not set"
                        )

                        HorizontalDivider(
                            modifier = Modifier.padding(vertical = 12.dp),
                            color = AppColors.BorderColor
                        )

                        ProfileInfoRow(
                            icon = Icons.Filled.Work,
                            label = "Role",
                            value = uiState.user?.userRole?.replace("_", " ")?.lowercase()
                                ?.replaceFirstChar { it.uppercase() } ?: "Not set"
                        )
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Security Card
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    colors = CardDefaults.cardColors(
                        containerColor = AppColors.CardBackground
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text(
                            text = "Security",
                            fontSize = 16.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = AppColors.PrimaryText
                        )

                        Spacer(modifier = Modifier.height(16.dp))

                        OutlinedButton(
                            onClick = { showChangePasswordDialog = true },
                            modifier = Modifier.fillMaxWidth(),
                            colors = ButtonDefaults.outlinedButtonColors(
                                contentColor = AppColors.SuccessColor
                            )
                        ) {
                            Icon(
                                imageVector = Icons.Filled.Lock,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Spacer(modifier = Modifier.width(8.dp))
                            Text("Change Password")
                        }
                    }
                }

                Spacer(modifier = Modifier.height(24.dp))

                // Sign Out Button
                Button(
                    onClick = { showLogoutConfirmDialog = true },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = AppColors.ErrorColor
                    ),
                    shape = RoundedCornerShape(12.dp)
                ) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.Logout,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                    Spacer(modifier = Modifier.width(8.dp))
                    Text(
                        text = "Sign Out",
                        fontWeight = FontWeight.SemiBold
                    )
                }

                // Error message
                uiState.error?.let { error ->
                    Spacer(modifier = Modifier.height(16.dp))
                    Text(
                        text = error,
                        color = AppColors.ErrorColor,
                        fontSize = 14.sp,
                        modifier = Modifier.align(Alignment.CenterHorizontally)
                    )
                }
            }
        }
    }

    // Change Password Dialog
    if (showChangePasswordDialog) {
        ChangePasswordDialog(
            onDismiss = { showChangePasswordDialog = false },
            onChangePassword = { currentPassword, newPassword ->
                viewModel.changePassword(currentPassword, newPassword)
                showChangePasswordDialog = false
            }
        )
    }

    // Logout Confirmation Dialog
    if (showLogoutConfirmDialog) {
        AlertDialog(
            onDismissRequest = { showLogoutConfirmDialog = false },
            title = {
                Text(
                    text = "Sign Out",
                    color = AppColors.PrimaryText
                )
            },
            text = {
                Text(
                    text = "Are you sure you want to sign out?",
                    color = AppColors.SecondaryText
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        showLogoutConfirmDialog = false
                        viewModel.logout()
                        onLogout()
                    }
                ) {
                    Text(
                        text = "Sign Out",
                        color = AppColors.ErrorColor
                    )
                }
            },
            dismissButton = {
                TextButton(onClick = { showLogoutConfirmDialog = false }) {
                    Text(
                        text = "Cancel",
                        color = AppColors.SecondaryText
                    )
                }
            },
            containerColor = AppColors.CardBackground
        )
    }
}

@Composable
private fun ProfileInfoRow(
    icon: ImageVector,
    label: String,
    value: String
) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = AppColors.SecondaryText,
            modifier = Modifier.size(20.dp)
        )
        Spacer(modifier = Modifier.width(12.dp))
        Column {
            Text(
                text = label,
                fontSize = 12.sp,
                color = AppColors.SecondaryText
            )
            Text(
                text = value,
                fontSize = 16.sp,
                color = AppColors.PrimaryText
            )
        }
    }
}

@Composable
private fun ChangePasswordDialog(
    onDismiss: () -> Unit,
    onChangePassword: (currentPassword: String, newPassword: String) -> Unit
) {
    var currentPassword by remember { mutableStateOf("") }
    var newPassword by remember { mutableStateOf("") }
    var confirmPassword by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = "Change Password",
                color = AppColors.PrimaryText
            )
        },
        text = {
            Column {
                OutlinedTextField(
                    value = currentPassword,
                    onValueChange = { currentPassword = it },
                    label = { Text("Current Password") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = AppColors.PrimaryText,
                        unfocusedTextColor = AppColors.PrimaryText,
                        focusedBorderColor = AppColors.SuccessColor,
                        unfocusedBorderColor = AppColors.BorderColor,
                        focusedLabelColor = AppColors.SuccessColor,
                        unfocusedLabelColor = AppColors.SecondaryText
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = newPassword,
                    onValueChange = { newPassword = it },
                    label = { Text("New Password") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = AppColors.PrimaryText,
                        unfocusedTextColor = AppColors.PrimaryText,
                        focusedBorderColor = AppColors.SuccessColor,
                        unfocusedBorderColor = AppColors.BorderColor,
                        focusedLabelColor = AppColors.SuccessColor,
                        unfocusedLabelColor = AppColors.SecondaryText
                    )
                )

                Spacer(modifier = Modifier.height(12.dp))

                OutlinedTextField(
                    value = confirmPassword,
                    onValueChange = { confirmPassword = it },
                    label = { Text("Confirm New Password") },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedTextColor = AppColors.PrimaryText,
                        unfocusedTextColor = AppColors.PrimaryText,
                        focusedBorderColor = AppColors.SuccessColor,
                        unfocusedBorderColor = AppColors.BorderColor,
                        focusedLabelColor = AppColors.SuccessColor,
                        unfocusedLabelColor = AppColors.SecondaryText
                    )
                )

                error?.let {
                    Spacer(modifier = Modifier.height(8.dp))
                    Text(
                        text = it,
                        color = AppColors.ErrorColor,
                        fontSize = 12.sp
                    )
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    when {
                        currentPassword.isEmpty() -> error = "Current password is required"
                        newPassword.isEmpty() -> error = "New password is required"
                        newPassword.length < 8 -> error = "Password must be at least 8 characters"
                        newPassword != confirmPassword -> error = "Passwords do not match"
                        else -> onChangePassword(currentPassword, newPassword)
                    }
                }
            ) {
                Text(
                    text = "Change",
                    color = AppColors.SuccessColor
                )
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(
                    text = "Cancel",
                    color = AppColors.SecondaryText
                )
            }
        },
        containerColor = AppColors.CardBackground
    )
}
