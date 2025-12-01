package com.hestami_ai.myhomeagent.navigation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.hestami_ai.myhomeagent.ui.screens.auth.LoginScreen
import com.hestami_ai.myhomeagent.ui.screens.auth.SignupScreen
import com.hestami_ai.myhomeagent.ui.screens.chat.ChatScreen
import com.hestami_ai.myhomeagent.ui.screens.main.MainScreen
import com.hestami_ai.myhomeagent.ui.screens.profile.ProfileScreen
import com.hestami_ai.myhomeagent.ui.screens.properties.AddEditPropertyScreen
import com.hestami_ai.myhomeagent.ui.screens.properties.AddPropertyScreen
import com.hestami_ai.myhomeagent.ui.screens.properties.PropertyDetailScreen
import com.hestami_ai.myhomeagent.ui.screens.properties.media.MediaUploadScreen
import com.hestami_ai.myhomeagent.ui.screens.properties.media.MediaViewer
import com.hestami_ai.myhomeagent.ui.screens.properties.media.ModelViewerScreen
import com.hestami_ai.myhomeagent.ui.screens.properties.scanning.RoomScanScreen
import com.hestami_ai.myhomeagent.ui.screens.requests.CreateServiceRequestScreen
import com.hestami_ai.myhomeagent.ui.screens.requests.PropertyServiceRequestsScreen
import com.hestami_ai.myhomeagent.ui.screens.requests.ServiceRequestDetailScreen
import com.hestami_ai.myhomeagent.ui.screens.settings.SettingsScreen
import com.hestami_ai.myhomeagent.ui.screens.splash.SplashScreen
import timber.log.Timber

/**
 * Main navigation graph for the app.
 */
@Composable
fun AppNavGraph(
    navController: NavHostController,
    modifier: Modifier = Modifier
) {
    NavHost(
        navController = navController,
        startDestination = NavRoutes.Splash.route,
        modifier = modifier
    ) {
        // Splash screen - checks auth state
        composable(NavRoutes.Splash.route) {
            LaunchedEffect(Unit) { Timber.d("Navigating to Splash") }
            SplashScreen(
                onNavigateToLogin = {
                    navController.navigate(NavRoutes.Login.route) {
                        popUpTo(NavRoutes.Splash.route) { inclusive = true }
                    }
                },
                onNavigateToMain = {
                    navController.navigate(NavRoutes.Main.route) {
                        popUpTo(NavRoutes.Splash.route) { inclusive = true }
                    }
                }
            )
        }

        // Login screen
        composable(NavRoutes.Login.route) {
            LaunchedEffect(Unit) { Timber.d("Navigating to Login") }
            LoginScreen(
                onNavigateToSignup = {
                    navController.navigate(NavRoutes.Signup.route)
                },
                onNavigateToMain = {
                    navController.navigate(NavRoutes.Main.route) {
                        popUpTo(NavRoutes.Login.route) { inclusive = true }
                    }
                }
            )
        }

        // Signup screen
        composable(NavRoutes.Signup.route) {
            LaunchedEffect(Unit) { Timber.d("Navigating to Signup") }
            SignupScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onNavigateToLogin = {
                    navController.navigate(NavRoutes.Login.route) {
                        popUpTo(NavRoutes.Signup.route) { inclusive = true }
                    }
                }
            )
        }

        // Main screen with bottom navigation
        composable(NavRoutes.Main.route) {
            LaunchedEffect(Unit) { Timber.d("Navigating to Main") }
            MainScreen(
                onLogout = {
                    navController.navigate(NavRoutes.Login.route) {
                        popUpTo(NavRoutes.Main.route) { inclusive = true }
                    }
                },
                onNavigateToAddProperty = {
                    navController.navigate(NavRoutes.AddProperty.route)
                },
                onNavigateToCreateRequest = {
                    navController.navigate(NavRoutes.CreateServiceRequest.route)
                },
                onNavigateToChat = { propertyId ->
                    navController.navigate(NavRoutes.AIChat.createRoute(propertyId))
                },
                onNavigateToPropertyDetail = { property ->
                    NavigationState.selectedProperty = property
                    navController.navigate(NavRoutes.PropertyDetail.createRoute(property.id))
                },
                onNavigateToRequestDetail = { request ->
                    NavigationState.selectedServiceRequest = request
                    navController.navigate(NavRoutes.ServiceRequestDetail.createRoute(request.id))
                },
                onNavigateToProfile = {
                    navController.navigate(NavRoutes.Profile.route)
                },
                onNavigateToSettings = {
                    navController.navigate(NavRoutes.Settings.route)
                }
            )
        }

        // Profile screen
        composable(NavRoutes.Profile.route) {
            LaunchedEffect(Unit) { Timber.d("Navigating to Profile") }
            ProfileScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onLogout = {
                    navController.navigate(NavRoutes.Login.route) {
                        popUpTo(NavRoutes.Main.route) { inclusive = true }
                    }
                }
            )
        }

        // Settings screen
        composable(NavRoutes.Settings.route) {
            LaunchedEffect(Unit) { Timber.d("Navigating to Settings") }
            SettingsScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        // Add Property screen
        composable(NavRoutes.AddProperty.route) {
            LaunchedEffect(Unit) { Timber.d("Navigating to AddProperty") }
            AddPropertyScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onPropertyCreated = {
                    navController.popBackStack()
                }
            )
        }

        // Edit Property screen
        composable(
            route = NavRoutes.EditProperty.route,
            arguments = listOf(
                navArgument("propertyId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val propertyId = backStackEntry.arguments?.getString("propertyId")
            LaunchedEffect(Unit) { Timber.d("Navigating to EditProperty for propertyId: %s", propertyId) }
            
            val property = remember { NavigationState.selectedProperty as? com.hestami_ai.myhomeagent.data.model.Property }
            
            if (property != null) {
                AddEditPropertyScreen(
                    property = property,
                    onNavigateBack = {
                        navController.popBackStack()
                    },
                    onPropertySaved = {
                        // Pop back to property detail and refresh
                        navController.popBackStack()
                    }
                )
            } else {
                LaunchedEffect(propertyId) {
                    Timber.w("Property not found in NavigationState for edit, navigating back")
                    navController.popBackStack()
                }
            }
        }

        // Create Service Request screen
        composable(NavRoutes.CreateServiceRequest.route) {
            LaunchedEffect(Unit) { Timber.d("Navigating to CreateServiceRequest") }
            CreateServiceRequestScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                onRequestCreated = {
                    navController.popBackStack()
                }
            )
        }

        // AI Chat screen
        composable(
            route = NavRoutes.AIChat.route,
            arguments = listOf(
                navArgument("propertyId") {
                    type = NavType.StringType
                    defaultValue = "general"
                }
            )
        ) { backStackEntry ->
            val propertyId = backStackEntry.arguments?.getString("propertyId")
            LaunchedEffect(Unit) { Timber.d("Navigating to AIChat for propertyId: %s", propertyId) }
            ChatScreen(
                onNavigateBack = {
                    navController.popBackStack()
                },
                propertyId = if (propertyId == "general") null else propertyId
            )
        }

        // Property Detail screen
        composable(
            route = NavRoutes.PropertyDetail.route,
            arguments = listOf(
                navArgument("propertyId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val propertyId = backStackEntry.arguments?.getString("propertyId")
            LaunchedEffect(Unit) { Timber.d("Navigating to PropertyDetail for propertyId: %s", propertyId) }
            
            // Capture the property at composition time to avoid issues during back navigation
            val property = remember { NavigationState.selectedProperty as? com.hestami_ai.myhomeagent.data.model.Property }
            
            if (property != null) {
                PropertyDetailScreen(
                    property = property,
                    onNavigateBack = {
                        navController.popBackStack()
                        NavigationState.clearProperty()
                    },
                    onEditClick = {
                        navController.navigate(NavRoutes.EditProperty.createRoute(property.id))
                    },
                    onUploadMediaClick = {
                        navController.navigate(NavRoutes.MediaUpload.createRoute(property.id))
                    },
                    onManageMediaClick = {
                        // TODO: Navigate to full media management screen
                    },
                    onScanPropertyClick = {
                        navController.navigate(NavRoutes.RoomScan.createRoute(property.id))
                    },
                    onViewRequestsClick = {
                        navController.navigate(NavRoutes.PropertyServiceRequests.createRoute(property.id))
                    },
                    onRequestClick = { request ->
                        NavigationState.selectedServiceRequest = request
                        navController.navigate(NavRoutes.ServiceRequestDetail.createRoute(request.id))
                    },
                    onMediaClick = { media ->
                        NavigationState.selectedMedia = media
                        // Navigate to 3D model viewer for 3D models, otherwise use media viewer
                        if (media.is3DModel) {
                            navController.navigate(NavRoutes.ModelViewer.createRoute(media.id))
                        } else {
                            navController.navigate(NavRoutes.MediaViewer.createRoute(media.id))
                        }
                    }
                )
            } else {
                // Property not found, go back - use DisposableEffect to only run once
                LaunchedEffect(propertyId) {
                    Timber.w("Property not found in NavigationState, navigating back")
                    navController.popBackStack()
                }
            }
        }

        // Property Service Requests screen (filtered by property)
        composable(
            route = NavRoutes.PropertyServiceRequests.route,
            arguments = listOf(
                navArgument("propertyId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val propertyId = backStackEntry.arguments?.getString("propertyId")
            LaunchedEffect(Unit) { Timber.d("Navigating to PropertyServiceRequests for propertyId: %s", propertyId) }
            
            val property = remember { NavigationState.selectedProperty as? com.hestami_ai.myhomeagent.data.model.Property }
            
            if (property != null) {
                PropertyServiceRequestsScreen(
                    property = property,
                    onNavigateBack = {
                        navController.popBackStack()
                    },
                    onRequestClick = { request ->
                        NavigationState.selectedServiceRequest = request
                        navController.navigate(NavRoutes.ServiceRequestDetail.createRoute(request.id))
                    },
                    onCreateRequestClick = {
                        navController.navigate(NavRoutes.CreateServiceRequest.route)
                    }
                )
            } else {
                LaunchedEffect(propertyId) {
                    Timber.w("Property not found in NavigationState for service requests, navigating back")
                    navController.popBackStack()
                }
            }
        }

        // Service Request Detail screen
        composable(
            route = NavRoutes.ServiceRequestDetail.route,
            arguments = listOf(
                navArgument("requestId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val requestId = backStackEntry.arguments?.getString("requestId")
            LaunchedEffect(Unit) { Timber.d("Navigating to ServiceRequestDetail for requestId: %s", requestId) }
            
            // Capture the request at composition time to avoid issues during back navigation
            val request = remember { NavigationState.selectedServiceRequest as? com.hestami_ai.myhomeagent.data.model.ServiceRequest }
            
            if (request != null) {
                ServiceRequestDetailScreen(
                    request = request,
                    onNavigateBack = {
                        navController.popBackStack()
                        NavigationState.clearServiceRequest()
                    },
                    onCancelRequest = { _ ->
                        // TODO: Implement cancel request API call
                        navController.popBackStack()
                        NavigationState.clearServiceRequest()
                    }
                )
            } else {
                // Request not found, go back - use propertyId as key to only run once
                LaunchedEffect(requestId) {
                    Timber.w("ServiceRequest not found in NavigationState, navigating back")
                    navController.popBackStack()
                }
            }
        }

        // Media Upload screen
        composable(
            route = NavRoutes.MediaUpload.route,
            arguments = listOf(
                navArgument("propertyId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val propertyId = backStackEntry.arguments?.getString("propertyId") ?: ""
            
            MediaUploadScreen(
                propertyId = propertyId,
                onNavigateBack = {
                    navController.popBackStack()
                },
                onUploadComplete = {
                    navController.popBackStack()
                }
            )
        }

        // 3D Model Viewer screen
        composable(
            route = NavRoutes.ModelViewer.route,
            arguments = listOf(
                navArgument("mediaId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val mediaId = backStackEntry.arguments?.getString("mediaId")
            LaunchedEffect(Unit) { Timber.d("Navigating to ModelViewer for mediaId: %s", mediaId) }
            
            val media = remember { NavigationState.selectedMedia as? com.hestami_ai.myhomeagent.data.model.Media }
            
            if (media != null) {
                ModelViewerScreen(
                    media = media,
                    onNavigateBack = {
                        navController.popBackStack()
                        NavigationState.clearMedia()
                    }
                )
            } else {
                LaunchedEffect(mediaId) {
                    Timber.w("Media not found in NavigationState, navigating back")
                    navController.popBackStack()
                }
            }
        }

        // Media Viewer screen (images, videos)
        composable(
            route = NavRoutes.MediaViewer.route,
            arguments = listOf(
                navArgument("mediaId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val mediaId = backStackEntry.arguments?.getString("mediaId")
            LaunchedEffect(Unit) { Timber.d("Navigating to MediaViewer for mediaId: %s", mediaId) }
            
            val media = remember { NavigationState.selectedMedia as? com.hestami_ai.myhomeagent.data.model.Media }
            
            if (media != null) {
                MediaViewer(
                    media = media,
                    onDismiss = {
                        navController.popBackStack()
                        NavigationState.clearMedia()
                    },
                    onView3DModel = { model ->
                        NavigationState.selectedMedia = model
                        navController.navigate(NavRoutes.ModelViewer.createRoute(model.id))
                    }
                )
            } else {
                LaunchedEffect(mediaId) {
                    Timber.w("Media not found in NavigationState, navigating back")
                    navController.popBackStack()
                }
            }
        }

        // Room Scan screen
        composable(
            route = NavRoutes.RoomScan.route,
            arguments = listOf(
                navArgument("propertyId") {
                    type = NavType.StringType
                }
            )
        ) { backStackEntry ->
            val propertyId = backStackEntry.arguments?.getString("propertyId") ?: ""
            
            RoomScanScreen(
                propertyId = propertyId,
                onNavigateBack = {
                    navController.popBackStack()
                },
                onScanComplete = { scanPath ->
                    Timber.d("Scan completed: $scanPath")
                    // TODO: Upload scan to server
                    navController.popBackStack()
                }
            )
        }
    }
}
