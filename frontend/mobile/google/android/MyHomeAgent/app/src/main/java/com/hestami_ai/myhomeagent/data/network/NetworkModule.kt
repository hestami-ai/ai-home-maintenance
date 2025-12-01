package com.hestami_ai.myhomeagent.data.network

import android.content.Context
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.hestami_ai.myhomeagent.config.AppConfiguration
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import timber.log.Timber
import java.util.concurrent.TimeUnit

/**
 * Network module providing Retrofit and OkHttp instances.
 * Handles cookie-based authentication matching iOS implementation.
 */
@Suppress("unused")
object NetworkModule {

    private var cookieJar: PersistentCookieJar? = null
    private var retrofit: Retrofit? = null
    private var apiService: ApiService? = null

    /**
     * Initialize the network module with application context.
     * Must be called before using any network functionality.
     */
    fun initialize(context: Context) {
        if (cookieJar == null) {
            cookieJar = PersistentCookieJar(context.applicationContext)
            Timber.d("NetworkModule initialized")
        }
    }

    /**
     * Get the Gson instance configured for API responses.
     */
    fun provideGson(): Gson {
        return GsonBuilder()
            .setDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSSSS'Z'")
            .setLenient()
            .create()
    }

    /**
     * Get the OkHttpClient instance with cookie handling and interceptors.
     */
    fun provideOkHttpClient(): OkHttpClient {
        val jar = cookieJar ?: throw IllegalStateException(
            "NetworkModule not initialized. Call initialize(context) first."
        )

        val builder = OkHttpClient.Builder()
            .cookieJar(jar)
            .connectTimeout(AppConfiguration.requestTimeoutSeconds, TimeUnit.SECONDS)
            .readTimeout(AppConfiguration.requestTimeoutSeconds, TimeUnit.SECONDS)
            .writeTimeout(AppConfiguration.requestTimeoutSeconds, TimeUnit.SECONDS)

        // Add CSRF token interceptor
        builder.addInterceptor(csrfInterceptor())

        // Add common headers interceptor
        builder.addInterceptor(headersInterceptor())

        // Add logging interceptor for debug builds
        if (AppConfiguration.enableNetworkLogging) {
            val loggingInterceptor = HttpLoggingInterceptor { message ->
                Timber.tag("OkHttp").d(message)
            }.apply {
                level = HttpLoggingInterceptor.Level.BODY
            }
            builder.addInterceptor(loggingInterceptor)
        }

        return builder.build()
    }

    /**
     * Get the Retrofit instance.
     */
    fun provideRetrofit(): Retrofit {
        if (retrofit == null) {
            retrofit = Retrofit.Builder()
                .baseUrl(AppConfiguration.apiBaseUrl + "/")
                .client(provideOkHttpClient())
                .addConverterFactory(GsonConverterFactory.create(provideGson()))
                .build()
        }
        return retrofit!!
    }

    /**
     * Get the API service instance.
     */
    fun provideApiService(): ApiService {
        if (apiService == null) {
            apiService = provideRetrofit().create(ApiService::class.java)
        }
        return apiService!!
    }

    /**
     * Get the cookie jar for session management.
     */
    fun getCookieJar(): PersistentCookieJar {
        return cookieJar ?: throw IllegalStateException(
            "NetworkModule not initialized. Call initialize(context) first."
        )
    }

    /**
     * Check if user has an active session.
     */
    fun hasActiveSession(): Boolean {
        return cookieJar?.hasSessionCookie() ?: false
    }

    /**
     * Clear all session data (for logout).
     */
    fun clearSession() {
        cookieJar?.clearCookies()
        // Reset retrofit to pick up any configuration changes
        retrofit = null
        apiService = null
        Timber.d("Session cleared")
    }

    /**
     * Get the session cookie header for manual requests.
     * Returns the cookie header string or null if no session.
     */
    fun getSessionCookieHeader(): String? {
        val jar = cookieJar ?: return null
        val sessionValue = jar.getSessionCookieValue() ?: return null
        val csrfToken = jar.getCsrfToken()
        
        return if (csrfToken != null) {
            "hestami_session=$sessionValue; csrftoken=$csrfToken"
        } else {
            "hestami_session=$sessionValue"
        }
    }

    /**
     * Rewrite media URLs from localhost to the configured static media host.
     * Matches iOS NetworkManager.rewriteMediaURL implementation.
     */
    fun rewriteMediaUrl(urlString: String): String {
        val localhostPattern = "http://localhost:8090/media-secure"
        
        if (!urlString.contains(localhostPattern)) {
            return urlString
        }

        val replacementPattern = "https://${AppConfiguration.staticMediaHost}/media-secure"
        val rewrittenUrl = urlString.replace(localhostPattern, replacementPattern)

        if (AppConfiguration.enableVerboseLogging) {
            Timber.d("Rewrote URL: %s -> %s", urlString, rewrittenUrl)
        }

        return rewrittenUrl
    }

    /**
     * Interceptor to add CSRF token to mutating requests.
     */
    private fun csrfInterceptor(): Interceptor = Interceptor { chain ->
        val request = chain.request()
        val method = request.method

        // Add CSRF token for mutating requests
        if (method in listOf("POST", "PUT", "PATCH", "DELETE")) {
            val csrfToken = cookieJar?.getCsrfToken()
            if (csrfToken != null) {
                val newRequest = request.newBuilder()
                    .header("X-CSRFToken", csrfToken)
                    .build()
                return@Interceptor chain.proceed(newRequest)
            }
        }

        chain.proceed(request)
    }

    /**
     * Interceptor to add common headers to all requests.
     */
    private fun headersInterceptor(): Interceptor = Interceptor { chain ->
        val request = chain.request().newBuilder()
            .header("Content-Type", "application/json")
            .header("Accept", "application/json")
            .build()
        chain.proceed(request)
    }
}
