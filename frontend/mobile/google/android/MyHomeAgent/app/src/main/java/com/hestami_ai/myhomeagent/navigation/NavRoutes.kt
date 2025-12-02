package com.hestami_ai.myhomeagent.navigation

/**
 * Navigation routes for the app.
 */
@Suppress("unused")
sealed class NavRoutes(val route: String) {
    // Auth routes
    data object Splash : NavRoutes("splash")
    data object Login : NavRoutes("login")
    data object Signup : NavRoutes("signup")
    
    // Main app routes
    data object Main : NavRoutes("main")
    data object Dashboard : NavRoutes("dashboard")
    data object Properties : NavRoutes("properties")
    data object AddProperty : NavRoutes("add_property")
    data object EditProperty : NavRoutes("edit_property/{propertyId}") {
        fun createRoute(propertyId: String) = "edit_property/$propertyId"
    }
    data object PropertyDetail : NavRoutes("property/{propertyId}") {
        fun createRoute(propertyId: String) = "property/$propertyId"
    }
    data object ServiceRequests : NavRoutes("service_requests")
    data object PropertyServiceRequests : NavRoutes("property_service_requests/{propertyId}") {
        fun createRoute(propertyId: String) = "property_service_requests/$propertyId"
    }
    data object CreateServiceRequest : NavRoutes("create_service_request")
    data object ServiceRequestDetail : NavRoutes("service_request/{requestId}") {
        fun createRoute(requestId: String) = "service_request/$requestId"
    }
    data object More : NavRoutes("more")
    data object Settings : NavRoutes("settings")
    data object Profile : NavRoutes("profile")
    data object Help : NavRoutes("help")
    data object AIChat : NavRoutes("ai_chat/{propertyId}") {
        fun createRoute(propertyId: String? = null) = 
            if (propertyId != null) "ai_chat/$propertyId" else "ai_chat/general"
    }
    
    // Media routes
    data object MediaUpload : NavRoutes("media_upload/{propertyId}") {
        fun createRoute(propertyId: String) = "media_upload/$propertyId"
    }
    data object MediaViewer : NavRoutes("media_viewer/{mediaId}") {
        fun createRoute(mediaId: String) = "media_viewer/$mediaId"
    }
    data object ModelViewer : NavRoutes("model_viewer/{mediaId}") {
        fun createRoute(mediaId: String) = "model_viewer/$mediaId"
    }
    
    // Scanning routes
    data object RoomScan : NavRoutes("room_scan/{propertyId}") {
        fun createRoute(propertyId: String) = "room_scan/$propertyId"
    }
}

/**
 * Bottom navigation destinations.
 */
@Suppress("unused")
enum class BottomNavDestination(
    val route: String,
    val title: String,
    val iconName: String
) {
    DASHBOARD("dashboard", "Dashboard", "dashboard"),
    PROPERTIES("properties", "Properties", "home"),
    REQUESTS("service_requests", "Requests", "list"),
    AI_ASSISTANT("ai_chat", "AI Assistant", "smart_toy")
}
