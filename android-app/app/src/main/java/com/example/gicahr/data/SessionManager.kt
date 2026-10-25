package com.example.gicahr.data

import android.content.Context
import android.content.SharedPreferences
import com.example.gicahr.data.model.User
import kotlinx.serialization.json.Json

class SessionManager(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("gica_hr_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_USER = "current_user"
        private const val KEY_LANG = "language"
        private const val DEFAULT_SERVER_URL = "http://10.0.2.2:8081/api"
    }

    fun getServerUrl(): String {
        return prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
    }

    fun saveServerUrl(url: String) {
        val cleanUrl = url.trim().removeSuffix("/")
        prefs.edit().putString(KEY_SERVER_URL, cleanUrl).apply()
    }

    fun saveUser(user: User) {
        val jsonString = Json.encodeToString(User.serializer(), user)
        prefs.edit().putString(KEY_USER, jsonString).apply()
    }

    fun getUser(): User? {
        val jsonString = prefs.getString(KEY_USER, null) ?: return null
        return try {
            Json.decodeFromString(User.serializer(), jsonString)
        } catch (e: Exception) {
            null
        }
    }

    fun clearSession() {
        prefs.edit().remove(KEY_USER).apply()
    }

    fun getLanguage(): String {
        return prefs.getString(KEY_LANG, "fr") ?: "fr"
    }

    fun saveLanguage(lang: String) {
        prefs.edit().putString(KEY_LANG, lang).apply()
    }

    fun getThemeMode(): String {
        return prefs.getString("theme_mode", "system") ?: "system"
    }

    fun saveThemeMode(mode: String) {
        prefs.edit().putString("theme_mode", mode).apply()
    }
}
