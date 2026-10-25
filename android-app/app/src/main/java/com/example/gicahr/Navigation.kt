package com.example.gicahr

import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation3.runtime.entryProvider
import androidx.navigation3.runtime.rememberNavBackStack
import androidx.navigation3.ui.NavDisplay
import com.example.gicahr.data.DataRepository
import com.example.gicahr.data.SessionManager
import com.example.gicahr.ui.main.MainAppLayout
import com.example.gicahr.ui.screens.LoginScreen

@Composable
fun MainNavigation(
    sessionManager: SessionManager,
    repository: DataRepository,
    currentTheme: String,
    onThemeChange: (String) -> Unit
) {
    val initialRoute = if (sessionManager.getUser() != null) Main else Login
    val backStack = rememberNavBackStack(initialRoute)

    var currentLanguage by remember { mutableStateOf(sessionManager.getLanguage()) }
    var currentUser by remember { mutableStateOf(sessionManager.getUser()) }

    NavDisplay(
        backStack = backStack,
        onBack = { backStack.removeLastOrNull() },
        entryProvider = entryProvider {
            entry<Login> {
                LoginScreen(
                    sessionManager = sessionManager,
                    repository = repository,
                    currentLanguage = currentLanguage,
                    onLanguageToggle = { lang ->
                        sessionManager.saveLanguage(lang)
                        currentLanguage = lang
                    },
                    onLoginSuccess = { user ->
                        currentUser = user
                        backStack.add(Main)
                    }
                )
            }
            entry<Main> {
                currentUser?.let { user ->
                    MainAppLayout(
                        user = user,
                        sessionManager = sessionManager,
                        repository = repository,
                        currentLanguage = currentLanguage,
                        currentTheme = currentTheme,
                        onThemeChange = onThemeChange,
                        onLogout = {
                            sessionManager.clearSession()
                            currentUser = null
                            backStack.add(Login)
                        }
                    )
                }
            }
        },
        modifier = Modifier.fillMaxSize()
    )
}
