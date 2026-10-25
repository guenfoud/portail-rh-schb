package com.example.gicahr

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.example.gicahr.data.DataRepository
import com.example.gicahr.data.SessionManager
import com.example.gicahr.theme.GicaHRTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val sessionManager = SessionManager(applicationContext)
        val repository = DataRepository(sessionManager)

        enableEdgeToEdge()
        setContent {
            var themeMode by remember { mutableStateOf(sessionManager.getThemeMode()) }
            val darkTheme = when (themeMode) {
                "light" -> false
                "dark" -> true
                else -> androidx.compose.foundation.isSystemInDarkTheme()
            }

            GicaHRTheme(darkTheme = darkTheme) {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    MainNavigation(
                        sessionManager = sessionManager,
                        repository = repository,
                        currentTheme = themeMode,
                        onThemeChange = { mode ->
                            sessionManager.saveThemeMode(mode)
                            themeMode = mode
                        }
                    )
                }
            }
        }
    }
}
