package com.hestami_ai.myhomeagent.ui.screens.splash

import android.app.Application
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.hestami_ai.myhomeagent.R
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import com.hestami_ai.myhomeagent.auth.AuthManager
import com.hestami_ai.myhomeagent.ui.theme.AppColors
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * Splash screen UI state.
 */
sealed class SplashState {
    data object Loading : SplashState()
    data object Authenticated : SplashState()
    data object Unauthenticated : SplashState()
}

/**
 * ViewModel for splash screen.
 */
class SplashViewModel(application: Application) : ViewModel() {
    private val authManager = AuthManager.getInstance(application)

    private val _state = MutableStateFlow<SplashState>(SplashState.Loading)
    val state: StateFlow<SplashState> = _state.asStateFlow()

    init {
        checkAuthState()
    }

    private fun checkAuthState() {
        viewModelScope.launch {
            // Add a small delay for splash screen visibility
            delay(1000)

            // Check if user has valid session
            val isValid = authManager.validateSession()
            _state.value = if (isValid) {
                SplashState.Authenticated
            } else {
                SplashState.Unauthenticated
            }
        }
    }
}

class SplashViewModelFactory(private val application: Application) : ViewModelProvider.Factory {
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        if (modelClass.isAssignableFrom(SplashViewModel::class.java)) {
            @Suppress("UNCHECKED_CAST")
            return SplashViewModel(application) as T
        }
        throw IllegalArgumentException("Unknown ViewModel class")
    }
}

/**
 * Splash screen that checks authentication state.
 */
@Composable
fun SplashScreen(
    onNavigateToLogin: () -> Unit,
    onNavigateToMain: () -> Unit
) {
    val context = LocalContext.current
    val viewModel: SplashViewModel = viewModel(
        factory = SplashViewModelFactory(context.applicationContext as Application)
    )
    val state by viewModel.state.collectAsState()

    // Navigate based on auth state
    LaunchedEffect(state) {
        when (state) {
            is SplashState.Authenticated -> onNavigateToMain()
            is SplashState.Unauthenticated -> onNavigateToLogin()
            is SplashState.Loading -> { /* Keep showing splash */ }
        }
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(AppColors.PrimaryBackground),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            // App logo
            Image(
                painter = painterResource(id = R.mipmap.ic_launcher_foreground),
                contentDescription = "My Home Agent Logo",
                modifier = Modifier.size(150.dp)
            )

            Spacer(modifier = Modifier.height(24.dp))

            Text(
                text = "My Home Agent",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.PrimaryText
            )

            Spacer(modifier = Modifier.height(8.dp))

            Text(
                text = "by Hestami AI",
                fontSize = 14.sp,
                color = AppColors.SecondaryText
            )

            Spacer(modifier = Modifier.height(48.dp))

            CircularProgressIndicator(
                modifier = Modifier.size(32.dp),
                color = AppColors.SuccessColor,
                strokeWidth = 3.dp
            )
        }
    }
}
