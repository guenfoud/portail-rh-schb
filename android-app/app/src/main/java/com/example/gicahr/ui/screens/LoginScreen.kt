package com.example.gicahr.ui.screens

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.gicahr.data.DataRepository
import com.example.gicahr.data.SessionManager
import com.example.gicahr.data.model.User
import com.example.gicahr.theme.GicaTeal
import com.example.gicahr.utils.Localization
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LoginScreen(
    sessionManager: SessionManager,
    repository: DataRepository,
    currentLanguage: String,
    onLanguageToggle: (String) -> Unit,
    onLoginSuccess: (User) -> Unit
) {
    var matricule by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var showServerConfig by remember { mutableStateOf(false) }
    var serverUrlInput by remember { mutableStateOf(sessionManager.getServerUrl()) }

    val coroutineScope = rememberCoroutineScope()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .padding(24.dp)
    ) {
        // Language Toggle (Top End) and Server Config (Top Start)
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.TopCenter),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = {
                serverUrlInput = sessionManager.getServerUrl()
                showServerConfig = true
            }) {
                Icon(
                    imageVector = Icons.Default.Settings,
                    contentDescription = "Server Settings",
                    tint = MaterialTheme.colorScheme.primary
                )
            }

            // Language Selector
            Row(
                modifier = Modifier
                    .background(Color.LightGray.copy(alpha = 0.2f), RoundedCornerShape(8.dp))
                    .padding(2.dp)
            ) {
                Text(
                    text = "FR",
                    modifier = Modifier
                        .background(
                            if (currentLanguage == "fr") MaterialTheme.colorScheme.primary else Color.Transparent,
                            RoundedCornerShape(6.dp)
                        )
                        .clickable { onLanguageToggle("fr") }
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    color = if (currentLanguage == "fr") Color.White else MaterialTheme.colorScheme.onBackground,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp
                )
                Text(
                    text = "عربي",
                    modifier = Modifier
                        .background(
                            if (currentLanguage == "ar") MaterialTheme.colorScheme.primary else Color.Transparent,
                            RoundedCornerShape(6.dp)
                        )
                        .clickable { onLanguageToggle("ar") }
                        .padding(horizontal = 12.dp, vertical = 6.dp),
                    color = if (currentLanguage == "ar") Color.White else MaterialTheme.colorScheme.onBackground,
                    fontWeight = FontWeight.Bold,
                    fontSize = 12.sp
                )
            }
        }

        // Login Card Content
        Card(
            modifier = Modifier
                .fillMaxWidth()
                .align(Alignment.Center),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            elevation = CardDefaults.cardElevation(defaultElevation = 4.dp)
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Header Branding
                Text(
                    text = Localization.getString("app_name", currentLanguage),
                    fontSize = 28.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = TextAlign.Center
                )

                Text(
                    text = Localization.getString("login_title", currentLanguage),
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    textAlign = TextAlign.Center,
                    lineHeight = 20.sp
                )

                Spacer(modifier = Modifier.height(8.dp))

                // Matricule Input
                OutlinedTextField(
                    value = matricule,
                    onValueChange = { matricule = it },
                    label = { Text(Localization.getString("matricule", currentLanguage)) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Password Input
                OutlinedTextField(
                    value = password,
                    onValueChange = { password = it },
                    label = { Text(Localization.getString("password", currentLanguage)) },
                    visualTransformation = PasswordVisualTransformation(),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                errorMessage?.let { error ->
                    Text(
                        text = error,
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                Spacer(modifier = Modifier.height(8.dp))

                // Connect Button
                Button(
                    onClick = {
                        if (matricule.isBlank() || password.isBlank()) {
                            errorMessage = Localization.getString("error_fields", currentLanguage)
                            return@Button
                        }
                        errorMessage = null
                        isLoading = true
                        coroutineScope.launch {
                            try {
                                val user = repository.login(matricule, password)
                                sessionManager.saveUser(user)
                                onLoginSuccess(user)
                            } catch (e: Exception) {
                                e.printStackTrace()
                                errorMessage = Localization.getString("error_login", currentLanguage)
                            } finally {
                                isLoading = false
                            }
                        }
                    },
                    enabled = !isLoading,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(48.dp),
                    shape = RoundedCornerShape(8.dp)
                ) {
                    if (isLoading) {
                        CircularProgressIndicator(color = Color.White, modifier = Modifier.size(24.dp))
                    } else {
                        Text(
                            text = Localization.getString("btn_login", currentLanguage),
                            fontSize = 16.sp,
                            fontWeight = FontWeight.Bold
                        )
                    }
                }
            }
        }

        // Server Config Dialog
        if (showServerConfig) {
            AlertDialog(
                onDismissRequest = { showServerConfig = false },
                title = { Text(Localization.getString("server_config", currentLanguage)) },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(
                            text = Localization.getString("server_url", currentLanguage),
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                        OutlinedTextField(
                            value = serverUrlInput,
                            onValueChange = { serverUrlInput = it },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                },
                confirmButton = {
                    Button(onClick = {
                        if (serverUrlInput.isNotBlank()) {
                            sessionManager.saveServerUrl(serverUrlInput)
                            showServerConfig = false
                        }
                    }) {
                        Text(Localization.getString("btn_save", currentLanguage))
                    }
                },
                dismissButton = {
                    TextButton(onClick = { showServerConfig = false }) {
                        Text(Localization.getString("btn_cancel", currentLanguage))
                    }
                }
            )
        }
    }
}
