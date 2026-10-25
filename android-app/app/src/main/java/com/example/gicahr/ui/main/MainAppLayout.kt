package com.example.gicahr.ui.main

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.example.gicahr.data.DataRepository
import com.example.gicahr.data.SessionManager
import com.example.gicahr.data.model.User
import com.example.gicahr.ui.screens.*
import com.example.gicahr.utils.Localization

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainAppLayout(
    user: User,
    sessionManager: SessionManager,
    repository: DataRepository,
    currentLanguage: String,
    currentTheme: String,
    onThemeChange: (String) -> Unit,
    onLogout: () -> Unit
) {
    var selectedScreen by remember { mutableStateOf("dashboard") }

    // Rôles check
    val isSupervisor = user.role.equals("supervisor", ignoreCase = true)
    val isHR = user.role.equals("hr", ignoreCase = true)
    val isManager = isSupervisor || isHR

    val navigationItems = remember(currentLanguage, user.role) {
        buildList {
            add(NavigationItem("dashboard", Localization.getString("dashboard", currentLanguage), Icons.Default.Home))
            add(NavigationItem("pointages", Localization.getString("pointages", currentLanguage), Icons.Default.DateRange))
            add(NavigationItem("requests", Localization.getString("recuperations", currentLanguage), Icons.Default.Send))
            if (isSupervisor) {
                add(NavigationItem("team", Localization.getString("team", currentLanguage), Icons.Default.Face))
                add(NavigationItem("approvals", Localization.getString("approvals", currentLanguage), Icons.Default.CheckCircle))
            } else if (isHR) {
                add(NavigationItem("team", Localization.getString("employees", currentLanguage), Icons.Default.Face))
                add(NavigationItem("approvals", Localization.getString("approvals", currentLanguage), Icons.Default.CheckCircle))
                add(NavigationItem("settings", Localization.getString("settings", currentLanguage), Icons.Default.Settings))
            }
        }
    }

    val currentTitle = remember(selectedScreen, currentLanguage) {
        when (selectedScreen) {
            "dashboard" -> Localization.getString("dashboard", currentLanguage)
            "pointages" -> Localization.getString("pointages", currentLanguage)
            "requests" -> Localization.getString("absences", currentLanguage)
            "team" -> if (isHR) Localization.getString("employees", currentLanguage) else Localization.getString("team", currentLanguage)
            "approvals" -> Localization.getString("approvals", currentLanguage)
            "settings" -> Localization.getString("settings", currentLanguage)
            else -> "SCHB Gica"
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(currentTitle) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                ),
                actions = {
                    val isSystemDark = androidx.compose.foundation.isSystemInDarkTheme()
                    val isDark = currentTheme == "dark" || (currentTheme == "system" && isSystemDark)
                    IconButton(onClick = {
                        val newTheme = if (isDark) "light" else "dark"
                        onThemeChange(newTheme)
                    }) {
                        Icon(
                            imageVector = if (isDark) Icons.Default.Brightness7 else Icons.Default.Brightness4,
                            contentDescription = "Toggle Theme",
                            tint = MaterialTheme.colorScheme.onPrimary
                        )
                    }
                    IconButton(onClick = onLogout) {
                        Icon(
                            imageVector = Icons.Default.ExitToApp,
                            contentDescription = "Logout",
                            tint = MaterialTheme.colorScheme.onPrimary
                        )
                    }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                navigationItems.forEach { item ->
                    NavigationBarItem(
                        selected = selectedScreen == item.route,
                        onClick = { selectedScreen = item.route },
                        label = { Text(item.title) },
                        icon = { Icon(imageVector = item.icon, contentDescription = item.title) }
                    )
                }
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            when (selectedScreen) {
                "dashboard" -> DashboardScreen(user = user, repository = repository, currentLanguage = currentLanguage)
                "pointages" -> PointagesScreen(user = user, repository = repository, currentLanguage = currentLanguage)
                "requests" -> RequestsScreen(user = user, repository = repository, currentLanguage = currentLanguage)
                "team" -> if (isManager) TeamScreen(user = user, repository = repository, currentLanguage = currentLanguage)
                "approvals" -> if (isManager) ApprovalsScreen(user = user, repository = repository, currentLanguage = currentLanguage)
                "settings" -> if (isHR) SettingsScreen(user = user, repository = repository, currentLanguage = currentLanguage)
            }
        }
    }
}

data class NavigationItem(
    val route: String,
    val title: String,
    val icon: ImageVector
)
