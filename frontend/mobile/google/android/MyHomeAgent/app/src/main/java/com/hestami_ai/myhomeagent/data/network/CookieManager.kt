package com.hestami_ai.myhomeagent.data.network

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import timber.log.Timber
import java.util.concurrent.ConcurrentHashMap

/**
 * Persistent cookie manager that stores cookies securely using EncryptedSharedPreferences.
 * Handles session cookies (hestami_session) and CSRF tokens.
 */
@Suppress("unused")
class PersistentCookieJar(context: Context) : CookieJar {

    companion object {
        private const val PREFS_NAME = "cookie_prefs"
        private const val SESSION_COOKIE_NAME = "hestami_session"
        private const val CSRF_COOKIE_NAME = "csrftoken"
    }

    private val cookieStore = ConcurrentHashMap<String, MutableList<Cookie>>()
    private val encryptedPrefs: SharedPreferences

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        encryptedPrefs = EncryptedSharedPreferences.create(
            context,
            PREFS_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )

        // Load persisted cookies on init
        loadPersistedCookies()
    }

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        val host = url.host
        Timber.d("Saving ${cookies.size} cookies for host: $host")

        val hostCookies = cookieStore.getOrPut(host) { mutableListOf() }

        for (cookie in cookies) {
            // Remove existing cookie with same name
            hostCookies.removeAll { it.name == cookie.name }
            // Add new cookie
            hostCookies.add(cookie)

            Timber.d("Saved cookie: ${cookie.name} = ${cookie.value.take(20)}...")

            // Persist important cookies
            if (cookie.name == SESSION_COOKIE_NAME || cookie.name == CSRF_COOKIE_NAME) {
                persistCookie(host, cookie)
            }
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val host = url.host
        val cookies = cookieStore[host] ?: emptyList()

        // Filter out expired cookies
        val validCookies = cookies.filter { !it.hasExpired() }

        Timber.d("Loading ${validCookies.size} cookies for host: $host, URL: $url")
        Timber.d("Cookie store hosts: ${cookieStore.keys}")
        validCookies.forEach { cookie ->
            Timber.d("  Cookie: ${cookie.name}=${cookie.value.take(20)}... domain=${cookie.domain}")
        }
        return validCookies
    }

    /**
     * Check if we have a valid session cookie.
     */
    fun hasSessionCookie(): Boolean {
        return cookieStore.values.flatten().any { 
            it.name == SESSION_COOKIE_NAME && !it.hasExpired() 
        }
    }

    /**
     * Get the session cookie value if available.
     */
    fun getSessionCookieValue(): String? {
        return cookieStore.values.flatten()
            .find { it.name == SESSION_COOKIE_NAME && !it.hasExpired() }
            ?.value
    }

    /**
     * Get the CSRF token value if available.
     */
    fun getCsrfToken(): String? {
        return cookieStore.values.flatten()
            .find { it.name == CSRF_COOKIE_NAME && !it.hasExpired() }
            ?.value
    }

    /**
     * Clear all cookies.
     */
    fun clearCookies() {
        Timber.d("Clearing all cookies")
        cookieStore.clear()
        encryptedPrefs.edit { clear() }
    }

    /**
     * Clear session-related cookies only.
     */
    fun clearSessionCookies() {
        Timber.d("Clearing session cookies")
        cookieStore.values.forEach { cookies ->
            cookies.removeAll { it.name == SESSION_COOKIE_NAME }
        }
        encryptedPrefs.edit {
            remove("${SESSION_COOKIE_NAME}_value")
            remove("${SESSION_COOKIE_NAME}_host")
            remove("${SESSION_COOKIE_NAME}_expires")
        }
    }

    private fun persistCookie(host: String, cookie: Cookie) {
        encryptedPrefs.edit {
            putString("${cookie.name}_value", cookie.value)
            putString("${cookie.name}_host", host)
            putLong("${cookie.name}_expires", cookie.expiresAt)
        }
        Timber.d("Persisted cookie: ${cookie.name}")
    }

    private fun loadPersistedCookies() {
        listOf(SESSION_COOKIE_NAME, CSRF_COOKIE_NAME).forEach { cookieName ->
            val value = encryptedPrefs.getString("${cookieName}_value", null)
            val host = encryptedPrefs.getString("${cookieName}_host", null)
            val expires = encryptedPrefs.getLong("${cookieName}_expires", 0L)

            if (value != null && host != null && expires > System.currentTimeMillis()) {
                val cookie = Cookie.Builder()
                    .name(cookieName)
                    .value(value)
                    .domain(host)
                    .path("/")
                    .expiresAt(expires)
                    .secure()
                    .httpOnly()
                    .build()

                val hostCookies = cookieStore.getOrPut(host) { mutableListOf() }
                hostCookies.add(cookie)
                Timber.d("Loaded persisted cookie: $cookieName for host: $host")
            }
        }
    }

    private fun Cookie.hasExpired(): Boolean {
        return expiresAt < System.currentTimeMillis()
    }
}
