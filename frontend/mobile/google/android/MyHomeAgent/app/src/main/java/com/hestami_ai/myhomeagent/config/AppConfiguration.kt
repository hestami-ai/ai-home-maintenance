package com.hestami_ai.myhomeagent.config

import android.content.Context
import android.content.pm.PackageManager
import com.hestami_ai.myhomeagent.BuildConfig
import timber.log.Timber

/**
 * Build environment types matching iOS implementation
 */
enum class BuildEnvironment {
    DEVELOPMENT,
    STAGING,
    PRODUCTION;

    companion object {
        val current: BuildEnvironment
            get() = if (BuildConfig.DEBUG) DEVELOPMENT else PRODUCTION
    }
}

/**
 * Centralized app configuration based on build environment.
 * Mirrors the iOS AppConfiguration.swift implementation.
 */
@Suppress("unused")
object AppConfiguration {

    // MARK: - Environment
    val environment: BuildEnvironment = BuildEnvironment.current

    // MARK: - API Configuration

    /** Base URL for API server */
    val apiBaseUrl: String
        get() = when (environment) {
            BuildEnvironment.DEVELOPMENT -> "https://dev-homeservices.hestami-ai.com"
            BuildEnvironment.STAGING -> "https://staging-homeservices.hestami-ai.com"
            BuildEnvironment.PRODUCTION -> "https://homeservices.hestami-ai.com"
        }

    /** Static media server host */
    val staticMediaHost: String
        get() = when (environment) {
            BuildEnvironment.DEVELOPMENT -> "dev-static.hestami-ai.com"
            BuildEnvironment.STAGING -> "staging-static.hestami-ai.com"
            BuildEnvironment.PRODUCTION -> "static.hestami-ai.com"
        }

    /** Static media server port */
    const val staticMediaPort: String = "443" // HTTPS port for all environments

    /** WebSocket base URL for chat (reserved for future use) */
    val wsBaseUrl: String
        get() = when (environment) {
            BuildEnvironment.DEVELOPMENT -> "wss://dev-homeservices.hestami-ai.com"
            BuildEnvironment.STAGING -> "wss://staging-homeservices.hestami-ai.com"
            BuildEnvironment.PRODUCTION -> "wss://homeservices.hestami-ai.com"
        }

    // MARK: - Feature Flags

    /** Enable verbose logging (debug builds only) */
    val enableVerboseLogging: Boolean
        get() = environment == BuildEnvironment.DEVELOPMENT

    /** Enable network request/response logging */
    val enableNetworkLogging: Boolean
        get() = environment == BuildEnvironment.DEVELOPMENT

    /** Enable crash reporting */
    val enableCrashReporting: Boolean
        get() = environment == BuildEnvironment.PRODUCTION || environment == BuildEnvironment.STAGING

    /** Enable analytics */
    val enableAnalytics: Boolean
        get() = environment == BuildEnvironment.PRODUCTION || environment == BuildEnvironment.STAGING

    /** Allow localhost connections (development only) */
    val allowLocalhostConnections: Boolean
        get() = environment == BuildEnvironment.DEVELOPMENT

    // MARK: - Cache Configuration

    /** Cache duration in seconds */
    val cacheDurationSeconds: Long
        get() = when (environment) {
            BuildEnvironment.DEVELOPMENT -> 300L // 5 minutes
            BuildEnvironment.STAGING -> 600L // 10 minutes
            BuildEnvironment.PRODUCTION -> 3600L // 1 hour
        }

    /** Enable response caching */
    const val enableCaching: Boolean = true

    // MARK: - Network Configuration

    /** Request timeout interval in seconds */
    val requestTimeoutSeconds: Long
        get() = when (environment) {
            BuildEnvironment.DEVELOPMENT -> 30L
            BuildEnvironment.STAGING -> 30L
            BuildEnvironment.PRODUCTION -> 20L
        }

    /** Maximum number of retry attempts for failed requests */
    val maxRetryAttempts: Int
        get() = when (environment) {
            BuildEnvironment.DEVELOPMENT -> 2
            BuildEnvironment.STAGING -> 3
            BuildEnvironment.PRODUCTION -> 3
        }

    // MARK: - App Information

    /** App version string */
    fun getAppVersion(context: Context): String {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            packageInfo.versionName ?: "1.0.0"
        } catch (_: PackageManager.NameNotFoundException) {
            "1.0.0"
        }
    }

    /** Build number / version code */
    fun getBuildNumber(context: Context): Long {
        return try {
            val packageInfo = context.packageManager.getPackageInfo(context.packageName, 0)
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.P) {
                packageInfo.longVersionCode
            } else {
                @Suppress("DEPRECATION")
                packageInfo.versionCode.toLong()
            }
        } catch (_: PackageManager.NameNotFoundException) {
            1L
        }
    }

    /** Package name / bundle identifier */
    fun getPackageName(context: Context): String {
        return context.packageName
    }

    /** Full version string (version + build) */
    fun getFullVersion(context: Context): String {
        return "${getAppVersion(context)} (${getBuildNumber(context)})"
    }

    // MARK: - Debug Helpers

    /** Print current configuration (debug builds only) */
    fun printConfiguration(context: Context) {
        if (BuildConfig.DEBUG) {
            Timber.d("=== App Configuration ===")
            Timber.d("Environment: ${environment.name}")
            Timber.d("API Base URL: $apiBaseUrl")
            Timber.d("Static Media Host: $staticMediaHost")
            Timber.d("App Version: ${getFullVersion(context)}")
            Timber.d("Verbose Logging: $enableVerboseLogging")
            Timber.d("Network Logging: $enableNetworkLogging")
            Timber.d("Cache Duration: ${cacheDurationSeconds}s")
            Timber.d("Request Timeout: ${requestTimeoutSeconds}s")
            Timber.d("========================")
        }
    }

    /** Validate configuration on app launch */
    fun validate(context: Context): Boolean {
        // Ensure URLs are valid
        val isValid = try {
            java.net.URL(apiBaseUrl)
            true
        } catch (_: Exception) {
            Timber.e("Invalid API base URL: $apiBaseUrl")
            false
        }

        // Log configuration in debug builds
        if (BuildConfig.DEBUG) {
            Timber.i("App configured for ${environment.name} environment")
            printConfiguration(context)
        }

        return isValid
    }
}
